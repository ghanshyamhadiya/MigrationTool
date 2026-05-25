import { Router } from "express";
import pool from "../utils/db.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();


router.get('/logs', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query("SELECT * FROM conversion_log WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error("[db] error fetching logs:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
