import express from "express";
import cors from "cors";
import geminiRoutes from "./routes/gemini.routes.js";
import claudeRoutes from "./routes/claude.routes.js";
import authRoutes from "./routes/auth.routes.js";
import dbRoutes from "./routes/db.routes.js";
import oracleRoutes from "./routes/oracle.routes.js";
import gitRoutes from "./routes/git.config.routes.js";
import { authMiddleware } from "./middleware/auth.middleware.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "*",
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

const port = 8080;

app.use("/claude", claudeRoutes);

app.use("/gemini", geminiRoutes);

app.use("/auth", authRoutes);

app.use("/oracle", oracleRoutes);

app.use("/git", gitRoutes);

app.use("/db", dbRoutes);

app.get("/", authMiddleware, (req, res) => {
  console.log(req.user);
  res.send("Welcome to the ODI SparkSQL Converter API");
});

app.listen(port, () => {
  console.log(`server listening on ${port}`);
});
