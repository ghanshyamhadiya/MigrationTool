import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.DB_HOST || "localhost",
  port:     process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "myapp_db",
  user:     process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "12345678",
});

pool.on("error", (err) => console.error("[db] pool error:", err.message));

export default pool;