import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../utils/db.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "odi_sparksql_converter";

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// POST /auth/signup
router.post("/signup", async (req, res) => {
  const { name, mobile_number, email, password } = req.body;

  if (!name || !mobile_number || !email || !password) {
    return res
      .status(400)
      .json({ error: "name, mobile_number, email, password are required" });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const result = await pool.query(
      `INSERT INTO users (name, mobile_number, email, password, otp, otp_expiry)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, mobile_number, is_verified`,
      [name, mobile_number, email, hashed, otp, otpExpiry],
    );

    const user = result.rows[0];
    const responseBody = {
      message: "User created. Please verify OTP sent to your mobile number.",
      user,
    };

    console.log("OTP for user (dev only):", otp);
    responseBody.otp_debug = otp;

    res.status(201).json(responseBody);
  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "Email or mobile number already exists" });
    }
    console.error("[auth] signup error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, mobile_number, password, is_verified
       FROM users
       WHERE email = $1`,
      [email],
    );

    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    if (!user.is_verified) {
      return res
        .status(403)
        .json({ error: "Please verify your account first" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const { password: _removed, ...safeUser } = user;
    const token = jwt.sign(
      { id: user.id, email: user.email, is_verified: user.is_verified },
      JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    res.json({ user: safeUser, token });
  } catch (err) {
    console.error("[auth] login error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/verify-otp
router.post("/verify-otp", async (req, res) => {
  const { mobile_number, email, otp } = req.body;

  if (!mobile_number || !email || !otp) {
    return res.status(400).json({ error: "mobile_number, email and otp are required" });
  }

  try {
    const result = await pool.query(
      `SELECT id, email, otp, otp_expiry, is_verified
       FROM users
       WHERE email = $1`,
      [email],
    );

    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.is_verified) {
      return res.status(400).json({ error: "User already verified" });
    }

    const now = new Date();
    if (String(user.otp) !== String(otp)) {
      return res.status(400).json({ error: "Invalid OTP" });
    }
    const otpExpiry =
      user.otp_expiry instanceof Date
        ? user.otp_expiry
        : new Date(user.otp_expiry);
    if (!otpExpiry || Number.isNaN(otpExpiry.getTime()) || now > otpExpiry) {
      return res.status(400).json({ error: "OTP expired" });
    }

    await pool.query(
      `UPDATE users
       SET is_verified = true,
           otp = NULL,
           otp_expiry = NULL
       WHERE id = $1`,
      [user.id],
    );

    const token = jwt.sign(
      { id: user.id, email: user.email, is_verified: true },
      JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    res.json({ message: "Account verified", token });
  } catch (err) {
    console.error("[auth] verify-otp error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/resend-otp", async (req, res) => {
  const { email, mobile_number } = req.body;

  if (!email || !mobile_number) {
    return res.status(400).json({ error: "email and mobile_number are required" });
  }

  try {
    const result = await pool.query(
      `SELECT id, email, mobile_number, is_verified, otp_expiry
       FROM users WHERE email = $1`,
      [email]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.is_verified) {
      return res.status(400).json({ error: "Account already verified" });
    }

    const now = new Date();
    if (user.otp_expiry && now < new Date(user.otp_expiry)) {
      const secondsLeft = Math.ceil((new Date(user.otp_expiry) - now) / 1000);
      return res.status(429).json({
        error: "Previous OTP still valid",
        wait_seconds: secondsLeft
      });
    }

    const newOtp = generateOTP();
    const newExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await pool.query(
      `UPDATE users SET otp = $1, otp_expiry = $2 WHERE id = $3`,
      [newOtp, newExpiry, user.id]
    );


    const response = {
      message: "New OTP sent to your mobile number",
      email: user.email
    };

    if (process.env.NODE_ENV !== "production") {
      response.otp_debug = newOtp;
    }

    res.json(response);
  } catch (err) {
    console.error("[auth] resend-otp error:", err.message);
    res.status(500).json({ error: "Failed to resend OTP" });
  }
});

router.post("/token", authMiddleware, async (req, res) => {
  const { token } = req.body;

  if (!token) return res.status(400).json({ error: "Token is not defined" });
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `UPDATE users SET git_token = $1 WHERE id = $2 RETURNING id, git_token`,
      [token, userId],
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to add token" });
  }
});

router.get("/show", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT git_token FROM users WHERE id = $1`,
      [userId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

export default router;
