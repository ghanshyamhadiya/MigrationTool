import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "odi_sparksql_converter";

export function authMiddleware(req, res, next) {
  const header = req.headers["authorization"];

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Ensure only verified accounts can access protected routes
    if (!decoded.is_verified) {
      return res.status(403).json({ error: "Account not verified" });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token invalid or expired" });
  }
}