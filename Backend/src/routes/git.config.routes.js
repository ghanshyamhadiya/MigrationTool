import { Octokit } from "@octokit/core";
import { Router } from "express";

const router = Router();

router.post("/verify-connection", async (req, res) => {
  const { token } = req.body;

  if (!token) return res.status(400).json({ error: "Token is required" });

  try {
    const testOctokit = new Octokit({ auth: token });
    const { data } = await testOctokit.request("GET /user");

    res.json({
      success: true,
      message: `Token verified and saved successfully`,
      user: {
        login: data.login,
        name: data.name,
        avatar_url: data.avatar_url,
        public_repos: data.public_repos,
      },
    });
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token. Not saved.",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;