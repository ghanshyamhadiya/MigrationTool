import { Router } from "express";
import fs from "fs";
import { upload } from "../utils/storage.js";
import { parseToNotebook } from "../utils/notebook.js";
import { aiConvert, loadInstructions, loadInstructionsFromGitHub, getCacheStatus, chatNotebook } from "../services/claude.service.js";
import { insertConversionLog } from "../utils/conversion.js";
import { Octokit } from "@octokit/core";

const router = Router();

const ENV_TOKENS = {
  reader: process.env.GIT_TOKEN,
  writer: process.env.CLIENT_GIT_TOKEN,
};

const CONVERT_PROMPT = `You are a Senior Data Engineering Migration Specialist.
Convert the TARGET ODI SQL file into a complete Databricks Spark SQL Jupyter Notebook (.ipynb).
Follow ALL rules in the SAMPLE instructions file exactly.
CELL TYPE RULES:
- Widget cells (dbutils.widgets.*) → Python cell, NO magic prefix
- ALL SQL cells → first line MUST be "-- MAGIC %sql\\n"
- Never put dbutils inside a %sql cell
OUTPUT RULES:
- Return ONLY raw valid .ipynb JSON, nothing before { or after }`;

	
const INSTRUCTION_SOURCES = {
  "sql-sparksql": {
    owner:  process.env.SQL_SPARKSQL_GITHUB_OWNER  || "iamhadiya13-cyber",
    repo:   process.env.SQL_SPARKSQL_GITHUB_REPO   || "ODI-REPO",
    path:   process.env.SQL_SPARKSQL_GITHUB_PATH   || "sql-sparksql.md",
    branch: process.env.SQL_SPARKSQL_GITHUB_BRANCH || "main",
  },
  "plsql-sparksql": {
    owner:  process.env.PLSQL_SPARKSQL_GITHUB_OWNER  || "iamhadiya13-cyber",
    repo:   process.env.PLSQL_SPARKSQL_GITHUB_REPO   || "ODI-REPO",
    path:   process.env.PLSQL_SPARKSQL_GITHUB_PATH   || "plsql-sparksql.md",
    branch: process.env.PLSQL_SPARKSQL_GITHUB_BRANCH || "main",
  },
  "sql-pyspark": {
    owner:  process.env.SQL_PYSPARK_GITHUB_OWNER  || "iamhadiya13-cyber",
    repo:   process.env.SQL_PYSPARK_GITHUB_REPO   || "ODI-REPO",
    path:   process.env.SQL_PYSPARK_GITHUB_PATH   || "sql-pyspark.md",
    branch: process.env.SQL_PYSPARK_GITHUB_BRANCH || "main",
  },
  "plsql-pyspark": {
    owner:  process.env.PLSQL_PYSPARK_GITHUB_OWNER  || "iamhadiya13-cyber",
    repo:   process.env.PLSQL_PYSPARK_GITHUB_REPO   || "ODI-REPO",
    path:   process.env.PLSQL_PYSPARK_GITHUB_PATH   || "plsql-pyspark.md",
    branch: process.env.PLSQL_PYSPARK_GITHUB_BRANCH || "main",
  },
};


const resolveTokens = (r, w) => ({ reader: r || ENV_TOKENS.reader, writer: w || ENV_TOKENS.writer });
const makeKit       = (token) => new Octokit({ auth: token });
const toOutName     = (name) => "TRG_" + name.replace(/\.(txt|sql)$/i, "").replace(/[^a-z0-9]/gi, "_") + `_${Date.now()}.ipynb`;
const dbLog         = (fields) => insertConversionLog(fields).catch(e => console.error("[db]", e.message));

async function fetchFileContent(kit, owner, repo, filePath, branch) {
  const { data } = await kit.request("GET /repos/{owner}/{repo}/contents/{path}", {
    owner, repo, path: filePath, ref: branch,
  });
  return Buffer.from(data.content, "base64").toString("utf-8");
}

async function pushNotebook(kit, owner, repo, outputPath, content, branch, srcName) {
  let sha = null;
  try {
    const { data } = await kit.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner, repo, path: outputPath, ref: branch,
    });
    sha = data.sha;
  } catch (e) { if (e.status !== 404) throw e; }

  await kit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    owner, repo, path: outputPath, branch,
    message: `Convert ${srcName} → ${outputPath.split("/").pop()}`,
    content: Buffer.from(content).toString("base64"),
    ...(sha && { sha }),
  });
}

// load instructions once at startup — cached in service memory
(async () => {
  for (const [name, src] of Object.entries(INSTRUCTION_SOURCES)) {
  try {
    await loadInstructionsFromGitHub(src, name);
  } catch (err) {
    console.warn(`[claude] startup load failed for "${name}":`, err.message);
    const local = process.env.INSTRUCTIONS_FILE;
    if (local && fs.existsSync(local)) loadInstructions(local, name);
  }
  }
})();


router.post("/reload-instructions", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "send file in field: file" });
  const { name } = req.body;
  if (!INSTRUCTION_SOURCES[name]) return res.status(400).json({ error: `name must be one of: ${Object.keys(INSTRUCTION_SOURCES).join(", ")}` });
  try {
    loadInstructions(req.file.path, name);
    res.json({ ok: true, source: req.file.originalname });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
});

router.post("/reload-instructions-github", async (req, res) => {
  const { name } = req.body;
  if (!INSTRUCTION_SOURCES[name]) return res.status(400).json({ error: `name must be one of: ${Object.keys(INSTRUCTION_SOURCES).join(", ")}` });
  const src = INSTRUCTION_SOURCES[name];
  const owner  = req.body.owner  || src.owner;
  const repo   = req.body.repo   || src.repo;
  const path   = req.body.path   || src.path;
  const branch = req.body.branch || src.branch;
  try {
    await loadInstructionsFromGitHub({ owner, repo, path, branch });
    res.json({ ok: true, source: `${owner}/${repo}/${path}@${branch}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/cache-status", (req, res) => res.json(getCacheStatus()));

function buildRouter(name) {
  const sub = Router();
// GET /claude/files
sub.get("/files", async (req, res) => {
  const { srcOwner, srcRepo, srcFolder = "", srcBranch = "main", readerToken } = req.query;

  if (!srcOwner || !srcRepo)
    return res.status(400).json({ error: "srcOwner and srcRepo required" });

  const kit = makeKit(readerToken || ENV_TOKENS.reader);

  try {
    const { data } = await kit.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner: srcOwner, repo: srcRepo, path: srcFolder, ref: srcBranch,
    });

    const files = Array.isArray(data)
      ? data
          .filter(f => f.type === "file" && /\.(txt|sql)$/i.test(f.name))
          .map(f => ({ srcName: f.name, trgName: toOutName(f.name), path: f.path, size: f.size, sha: f.sha, url: f.html_url }))
      : [];

    res.json({ total: files.length, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// POST /claude/generate  (multipart: field "target")
sub.post("/generate", upload.single("target"), async (req, res) => {
  const targetFile = req.file;
  if (!targetFile) return res.status(400).json({ error: "send target file in field: target" });

  const {
    destOwner = "yashkanara", destRepo = "ODI-to-Databricks",
    destFolder = "test-conversions", destBranch = "main",
    writerToken,
  } = req.body;

  const tokens     = resolveTokens(null, writerToken);
  const outName    = toOutName(targetFile.originalname);
  const outputPath = destFolder ? `${destFolder}/${outName}` : outName;

  try {
    // aiConvert reads file from disk path directly
    const { text, stats } = await aiConvert(targetFile.path, CONVERT_PROMPT, name);
    const notebook        = parseToNotebook(text);

    console.log(`[generate] pushing to ${destOwner}/${destRepo}/${outputPath}`);
    await pushNotebook(makeKit(tokens.writer), destOwner, destRepo, outputPath, JSON.stringify(notebook, null, 2), destBranch, targetFile.originalname);

    dbLog({ userId: 2, provider: "claude", targetFileName: targetFile.originalname, outputFileName: outName, ...stats, status: "success" });

    res.setHeader("Content-Disposition", `attachment; filename="${outName}"`);
    res.json({ ...notebook, _meta: { pushedTo: `${destOwner}/${destRepo}`, path: outputPath, branch: destBranch } });

  } catch (error) {
    dbLog({ userId: 2, provider: "claude", targetFileName: targetFile.originalname, outputFileName: outName, status: "failed", errorMessage: error.message });
    res.status(500).json({ error: error.message });
  } finally {
    if (targetFile?.path && fs.existsSync(targetFile.path)) fs.unlinkSync(targetFile.path);
  }
});


// POST /claude/convert-from-github
sub.post("/convert-from-github", async (req, res) => {
  const {
    srcOwner  = "yashkanara",        destOwner  = "iamhadiya13-cyber",
    srcRepo   = "ODI-to-Databricks", destRepo   = "my-databricks-notebooks",
    srcFolder = "test-conversions",  destFolder = "mappings",
    srcBranch = "main",              destBranch = "main",
    readerToken, writerToken,
  } = req.body;

  if (!srcOwner || !srcRepo)
    return res.status(400).json({ error: "srcOwner and srcRepo required" });

  const tokens    = resolveTokens(readerToken, writerToken);
  const readerKit = makeKit(tokens.reader);
  const writerKit = makeKit(tokens.writer);

  console.log(`[convert-from-github] src:  ${srcOwner}/${srcRepo}/${srcFolder}`);
  console.log(`[convert-from-github] dest: ${destOwner}/${destRepo}/${destFolder}`);
  console.log(`[convert-from-github] writerToken: ${tokens.writer?.slice(0, 25)}`);

  const results = [];

  try {
    const { data: dirContents } = await readerKit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      { owner: srcOwner, repo: srcRepo, path: srcFolder, ref: srcBranch },
    );

    const odiFiles = Array.isArray(dirContents)
      ? dirContents.filter(f => f.type === "file" && /\.(txt|sql)$/i.test(f.name))
      : [];

    if (!odiFiles.length) return res.json({ message: "No .txt or .sql files found.", results: [] });

    for (const fileInfo of odiFiles) {
      const trgName = toOutName(fileInfo.name);
      const entry   = { srcName: fileInfo.name, trgName, status: "pending", outputPath: null, error: null };

      try {
        // pass raw text — aiConvert accepts string, no tmp file needed
        const targetText = await fetchFileContent(readerKit, srcOwner, srcRepo, fileInfo.path, srcBranch);
        const { text, stats } = await aiConvert(targetText, CONVERT_PROMPT, name);

        const notebook   = parseToNotebook(text);
        const outputPath = destFolder ? `${destFolder}/${trgName}` : trgName;

        console.log(`[convert-from-github] pushing ${fileInfo.name} → ${destOwner}/${destRepo}/${outputPath}`);
        await pushNotebook(writerKit, destOwner, destRepo, outputPath, JSON.stringify(notebook, null, 2), destBranch, fileInfo.name);

        dbLog({ userId: 2, provider: "claude", targetFileName: fileInfo.name, outputFileName: trgName, ...stats, status: "success" });

        entry.status     = "ok";
        entry.outputPath = `https://github.com/${destOwner}/${destRepo}/blob/${destBranch}/${outputPath}`;

      } catch (err) {
        entry.status = "failed";
        entry.error  = err.message;
        dbLog({ userId: 2, provider: "claude", targetFileName: fileInfo.name, outputFileName: trgName, status: "failed", errorMessage: err.message });
      }

      results.push(entry);
    }

    res.json({
      total:  results.length,
      ok:     results.filter(r => r.status === "ok").length,
      failed: results.filter(r => r.status === "failed").length,
      results,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// POST /claude/convert-selected
sub.post("/convert-selected", async (req, res) => {
  const {
    srcOwner, srcRepo, srcBranch = "main",
    files = [],
    destOwner  = "iamhadiya13-cyber",
    destRepo   = "my-databricks-notebooks",
    destFolder = "mappings",
    destBranch = "main",
    readerToken, writerToken,
  } = req.body;

  if (!srcOwner || !srcRepo)
    return res.status(400).json({ error: "srcOwner and srcRepo required" });
  if (!Array.isArray(files) || !files.length)
    return res.status(400).json({ error: "files[] required and must not be empty" });

  const tokens    = resolveTokens(readerToken, writerToken);
  const readerKit = makeKit(tokens.reader);
  const writerKit = makeKit(tokens.writer);

  console.log(`[convert-selected] dest: ${destOwner}/${destRepo}/${destFolder}`);
  console.log(`[convert-selected] writerToken: ${tokens.writer?.slice(0, 25)}`);

  const results = [];

  try {
    for (const filePath of files) {
      const srcName = filePath.split("/").pop();
      const trgName = toOutName(srcName);
      const entry   = { srcName, trgName, path: filePath, status: "pending", outputPath: null, error: null };

      try {
        // pass raw text — aiConvert accepts string, no tmp file needed
        const targetText = await fetchFileContent(readerKit, srcOwner, srcRepo, filePath, srcBranch);
        const { text, stats } = await aiConvert(targetText, CONVERT_PROMPT, name);

        const notebook   = parseToNotebook(text);
        const outputPath = destFolder ? `${destFolder}/${trgName}` : trgName;

        console.log(`[convert-selected] pushing ${srcName} → ${destOwner}/${destRepo}/${outputPath}`);
        await pushNotebook(writerKit, destOwner, destRepo, outputPath, JSON.stringify(notebook, null, 2), destBranch, srcName);

        dbLog({ userId: 2, provider: "claude", targetFileName: srcName, outputFileName: trgName, ...stats, status: "success" });

        entry.status     = "ok";
        entry.outputPath = `https://github.com/${destOwner}/${destRepo}/blob/${destBranch}/${outputPath}`;

      } catch (err) {
        entry.status = "failed";
        entry.error  = err.message;
        dbLog({ userId: 2, provider: "claude", targetFileName: srcName, outputFileName: trgName, status: "failed", errorMessage: err.message });
      }

      results.push(entry);
    }

    res.json({
      total:  results.length,
      ok:     results.filter(r => r.status === "ok").length,
      failed: results.filter(r => r.status === "failed").length,
      results,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

return sub;
}

router.use("/sql-sparksql",   buildRouter("sql-sparksql"));
router.use("/plsql-sparksql", buildRouter("plsql-sparksql"));
router.use("/sql-pyspark",    buildRouter("sql-pyspark"));
router.use("/plsql-pyspark",  buildRouter("plsql-pyspark"));


// POST /claude/chat
router.post("/chat", async (req, res) => {
  const { notebook, message, history = [] } = req.body;
  if (!notebook || typeof notebook !== "object") return res.status(400).json({ error: "notebook (ipynb JSON) required" });
  if (!message?.trim()) return res.status(400).json({ error: "message required" });

  try {
    const { text, inputTokens, outputTokens } = await chatNotebook(notebook, history, message);
    res.json({ notebook: parseToNotebook(text), assistantMessage: text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;