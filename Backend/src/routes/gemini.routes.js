import { Router } from "express";
import fs from "fs";
import { upload } from "../utils/storage.js";
import { parseGeminiNotebook } from "../utils/gemini.notebook.js";
import { aiConvert2, loadInstructions, loadInstructionsFromGitHub, getCacheStatus } from "../services/gemini.service.js";
import { insertConversionLog } from "../utils/conversion.js";
import { Octokit } from "@octokit/core";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

// fallback tokens — overridden per request from frontend
const ENV_TOKENS = {
  reader: process.env.GIT_TOKEN,
  writer: process.env.CLIENT_GIT_TOKEN,
};

// const SAMPLE_REPO = {
//   owner:  process.env.SAMPLE_OWNER  || "iamhadiya13-cyber",
//   repo:   process.env.SAMPLE_REPO   || "demo",
//   path:   process.env.SAMPLE_PATH   || "README.md",
//   branch: process.env.SAMPLE_BRANCH || "main",
// };

// const SAMPLE_REPO = {
//   owner:  process.env.SAMPLE_OWNER  || "Naittik25",
//   repo:   process.env.SAMPLE_REPO   || "demo",
//   path:   process.env.SAMPLE_PATH   || "PLSQL.md",
//   branch: process.env.SAMPLE_BRANCH || "main",
// };

const CONVERT_PROMPT = `Follow all rules in the SAMPLE file exactly.
Convert the TARGET ODI SQL file into a complete Databricks Spark SQL Jupyter Notebook.
- Every SQL statement on its own line, blank line between statements, semicolons required
Return valid .ipynb JSON only.`;

// token priority: request body > env

	
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

const resolveTokens = (readerToken, writerToken) => ({
  reader: readerToken || ENV_TOKENS.reader,
  writer: writerToken || ENV_TOKENS.writer,
});

const makeKit = (token) => new Octokit({ auth: token });

// src filename e.g. DEP.txt → TRG_DEP_timestamp.ipynb
const toOutName = (name) =>
  "TRG_" + name.replace(/\.(txt|sql)$/i, "").replace(/[^a-z0-9]/gi, "_") + `_${Date.now()}.ipynb`;

const dbLog = (fields) => insertConversionLog(fields).catch(e => console.error("[db]", e.message));

// fetch sample instructions from sample repo
// async function fetchSample(kit) {
//   const { data } = await kit.request("GET /repos/{owner}/{repo}/contents/{path}", {
//     owner: SAMPLE_REPO.owner, repo: SAMPLE_REPO.repo,
//     path:  SAMPLE_REPO.path,  ref:  SAMPLE_REPO.branch,
//   });
//   console.log(`SAMPLE REPO INSERTED ${data.name}`)
//   return Buffer.from(data.content, "base64").toString("utf-8");
// }

// download file from github as text

async function fetchFileContent(kit, owner, repo, filePath, branch) {
  const { data } = await kit.request("GET /repos/{owner}/{repo}/contents/{path}", {
    owner, repo, path: filePath, ref: branch,
  });
  return Buffer.from(data.content, "base64").toString("utf-8");
}

// create or update file in github
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

// const dbLog = async (fields) => {
//   const mappedFields = {
//     ...fields,
//     // 1. MUST be lowercase 'success' to match your CREATE TABLE check constraint
//     status: (fields.status === 'success' || fields.status === 'ok') ? 'success' : 'failed',
//     // 2. Use 'user_id' (underscore) to match your PostgreSQL schema
//     user_id: fields.userId || 1 
//   };
  
//   try {
//     return await insertConversionLog(mappedFields);
//   } catch (e) {
//     // If DB fails, we log it but DON'T stop the GitHub process
//     console.error("[db] Check Constraint or Schema Error:", e.message);
//   }
// };

(async () => {
  for (const [name, src] of Object.entries(INSTRUCTION_SOURCES)) {
    try {
      await loadInstructionsFromGitHub(src, name);
    } catch (err) {
      console.warn(`[gemini] startup load failed for "${name}":`, err.message);
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
  const src    = INSTRUCTION_SOURCES[name];
  const owner  = req.body.owner  || src.owner;
  const repo   = req.body.repo   || src.repo;
  const path   = req.body.path   || src.path;
  const branch = req.body.branch || src.branch;
  try {
    await loadInstructionsFromGitHub({ owner, repo, path, branch }, name);
    res.json({ ok: true, source: `${owner}/${repo}/${path}@${branch}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/cache-status", (req, res) => res.json(getCacheStatus()));


function buildRouter(name) {
  const sub = Router();

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
          .map(f => ({
            srcName: f.name,           // original ODI file  e.g. DEP.txt
            trgName: toOutName(f.name),// output notebook    e.g. TRG_DEP_xxx.ipynb
            path:    f.path,
            size:    f.size,
            sha:     f.sha,
            url:     f.html_url,
          }))
      : [];

    res.json({ total: files.length, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

sub.post("/generate", authMiddleware, upload.single("target"), async (req, res) => {
  const targetFile = req.file;
  if (!targetFile) return res.status(400).json({ error: "Missing target file (field: target)" });

  const userId = req.user.id;

  const {
    destOwner  = "yashkanara",
    destRepo   = "ODI-to-Databricks",
    destFolder = "test-conversions",
    destBranch = "main",
    readerToken, writerToken,
  } = req.body;

  const tokens     = resolveTokens(readerToken, writerToken);
  const outName    = toOutName(targetFile.originalname);
  const outputPath = destFolder ? `${destFolder}/${outName}` : outName;
  let stats        = { inputTokens: null, outputTokens: null, totalTokens: null, cachedTokens: 0, timeTakenMs: null };

  try {
    // const sampleText = await fetchSample(makeKit(tokens.reader));
    const targetText = fs.readFileSync(targetFile.path, "utf-8");
    // const fullPrompt = `${CONVERT_PROMPT}\n\nSAMPLE INSTRUCTIONS:\n${sampleText}\n\nTARGET FILE TO CONVERT:\n${targetText}`;

    const { text: generatedText, stats: geminiStats } = await aiConvert2(targetText, CONVERT_PROMPT, name);
    stats = geminiStats;

    // const notebook        = parseGeminiNotebook(generatedText);
    // const notebookContent = JSON.stringify(notebook, null, 2);

    // // src: uploaded file → dest: github
    // console.log(`[generate] pushing to ${destOwner}/${destRepo}/${outputPath}`);
    // await pushNotebook(makeKit(tokens.writer), destOwner, destRepo, outputPath, notebookContent, destBranch, targetFile.originalname);

    const notebook = parseGeminiNotebook(generatedText);
    const notebookContent = JSON.stringify(notebook, null, 2);

    console.log("[generate] conversion complete (GitHub push disabled)");

    dbLog({ userId: userId, provider: "gemini", targetFileName: targetFile.originalname, outputFileName: outName, ...stats, status: "success" });

    res.setHeader("Content-Type", "application/x-ipynb+json");
    res.setHeader("Content-Disposition", `attachment; filename="${outName}"`);
    res.json({ ...notebook, _meta: { pushedTo: `${destOwner}/${destRepo}`, path: outputPath, branch: destBranch } });

  } catch (error) {
    dbLog({ userId: userId, provider: "gemini", targetFileName: targetFile.originalname, outputFileName: outName, ...stats, status: "failed" });
    res.status(500).json({ error: error.message });
  } finally {
    if (targetFile?.path && fs.existsSync(targetFile.path)) fs.unlinkSync(targetFile.path);
  }
});


sub.post("/convert-from-github", authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const {
    srcOwner   = "yashkanara",         destOwner  = "iamhadiya13-cyber",
    srcRepo    = "ODI-to-Databricks",  destRepo   = "my-databricks-notebooks",
    srcFolder  = "test-conversions",   destFolder = "mappings",
    srcBranch  = "main",               destBranch = "main",
    readerToken, writerToken,
  } = req.body;

res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");

const send = (data) => {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

  if (!srcOwner || !srcRepo)
    return res.status(400).json({ error: "srcOwner and srcRepo required" });

  const tokens    = resolveTokens(readerToken, writerToken);
  const readerKit = makeKit(tokens.reader);  // reads  src repo
  const writerKit = makeKit(tokens.writer);  // writes dest repo

  console.log(`[convert-from-github] src: ${srcOwner}/${srcRepo}/${srcFolder}`);
  console.log(`[convert-from-github] dest: ${destOwner}/${destRepo}/${destFolder}`);
  console.log(`[convert-from-github] writerToken starts with: ${tokens.writer?.slice(0, 25)}`);

  const results = [];

  try {
    // const sampleText = await fetchSample(readerKit);

    const { data: dirContents } = await readerKit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      { owner: srcOwner, repo: srcRepo, path: srcFolder, ref: srcBranch },
    );

    const odiFiles = Array.isArray(dirContents)
      ? dirContents.filter(f => f.type === "file" && /\.(txt|sql)$/i.test(f.name))
      : [];

    // if (!odiFiles.length) return res.json({ message: "No .txt or .sql files found.", results: [] });

    if (!odiFiles.length) {
      send({ message: "No .txt or .sql files found.", done: true });
      return res.end();
    }

    for (const fileInfo of odiFiles) {
      const trgName = toOutName(fileInfo.name);
      const entry   = { srcName: fileInfo.name, trgName, status: "pending", outputPath: null, error: null };

      try {
        // src github → AI → dest github
        const targetText = await fetchFileContent(readerKit, srcOwner, srcRepo, fileInfo.path, srcBranch);
        // const fullPrompt = `${CONVERT_PROMPT}\n\nSAMPLE INSTRUCTIONS:\n${sampleText}\n\nTARGET FILE TO CONVERT:\n${targetText}`;
        const { text: generatedText, stats } = await aiConvert2(targetText, CONVERT_PROMPT, name);

        const notebook   = parseGeminiNotebook(generatedText);
        const outputPath = destFolder ? `${destFolder}/${trgName}` : trgName;

        console.log(`[convert-from-github] pushing ${fileInfo.name} → ${destOwner}/${destRepo}/${outputPath}`);
        await pushNotebook(writerKit, destOwner, destRepo, outputPath, JSON.stringify(notebook, null, 2), destBranch, fileInfo.name);
        

        dbLog({ userId: userId, provider: "gemini", targetFileName: fileInfo.name, outputFileName: trgName, ...stats, status: "success" });

        send({
          srcName: fileInfo.name,
          trgName: trgName,
          status: "ok"
        });

        entry.status     = "ok";
        entry.outputPath = `https://github.com/${destOwner}/${destRepo}/blob/${destBranch}/${outputPath}`;

         

      } catch (err) {
        entry.status = "failed";
        entry.error  = err.message;
        dbLog({ userId: userId, provider: "gemini", targetFileName: fileInfo.name, outputFileName: trgName, status: "failed", errorMessage: err.message });
      
        send({
          srcName: fileInfo?.name,
          trgName: trgName,
          status: "failed",
          error: err.message
        });
      }
      

      results.push(entry);
    }

    send({ done: true });
    res.end(); 
    // res.json({
    //   total:   results.length,
    //   ok:      results.filter(r => r.status === "ok").length,
    //   failed:  results.filter(r => r.status === "failed").length,
    //   results,
    // });

  } catch (err) {
    send({
      status: "failed",
      error: err.message,
      done: true
    });
    res.end();                                        
    // send({
    //   srcName: fileInfo?.name,
    //   trgName: trgName,
    //   status: "failed",
    //   error: err.message
    // });
    //res.status(500).json({ error: err.message });
  }
});


sub.post("/convert-selected", authMiddleware, async (req, res) => {
  const userId = req.user.id;
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
  const readerKit = makeKit(tokens.reader);  // reads  src repo
  const writerKit = makeKit(tokens.writer);  // writes dest repo

  console.log(`[convert-selected] dest: ${destOwner}/${destRepo}/${destFolder}`);
  console.log(`[convert-selected] writerToken starts with: ${tokens.writer?.slice(0, 25)}`);

  const results = [];

  try {
    // const sampleText = await fetchSample(readerKit);

    for (const filePath of files) {
      const srcName = filePath.split("/").pop();
      const trgName = toOutName(srcName);
      const entry   = { srcName, trgName, path: filePath, status: "pending", outputPath: null, error: null };

      try {
        // src github → AI → dest github
        const targetText = await fetchFileContent(readerKit, srcOwner, srcRepo, filePath, srcBranch);
        // const fullPrompt = `${CONVERT_PROMPT}\n\nSAMPLE INSTRUCTIONS:\n${sampleText}\n\nTARGET FILE TO CONVERT:\n${targetText}`;
        const { text: generatedText, stats } = await aiConvert2(targetText, CONVERT_PROMPT, name);

        const notebook   = parseGeminiNotebook(generatedText);
        const outputPath = destFolder ? `${destFolder}/${trgName}` : trgName;

        console.log(`[convert-selected] pushing ${srcName} → ${destOwner}/${destRepo}/${outputPath}`);
        await pushNotebook(writerKit, destOwner, destRepo, outputPath, JSON.stringify(notebook, null, 2), destBranch, srcName);

        dbLog({ userId: userId, provider: "gemini", targetFileName: srcName, outputFileName: trgName, ...stats, status: "success" });

        entry.status     = "ok";
        entry.outputPath = `https://github.com/${destOwner}/${destRepo}/blob/${destBranch}/${outputPath}`;

      } catch (err) {
        entry.status = "failed";
        entry.error  = err.message;
        dbLog({ userId: userId, provider: "gemini", targetFileName: srcName, outputFileName: trgName, status: "failed", errorMessage: err.message });
      }

      results.push(entry);
    }

    res.json({
      total:   results.length,
      ok:      results.filter(r => r.status === "ok").length,
      failed:  results.filter(r => r.status === "failed").length,
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

export default router;