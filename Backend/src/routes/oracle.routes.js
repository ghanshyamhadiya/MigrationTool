import { Router } from "express";
import { Octokit } from "@octokit/core";
import oracledb from "oracledb";

const router = Router();

oracledb.fetchAsString = [oracledb.CLOB];
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// ── helpers ────────────────────────────────────────────────────────────────

function getDbConfig(body = {}) {
  const { db_user, db_pass, db_host, db_service } = body;
  if (!db_user || !db_pass || !db_host)
    throw new Error("db_user, db_pass, db_host required");
  return {
    user: db_user || process.env.ORACLE_USER,
    password: db_pass || process.env.ORACLE_PASSWORD,
    connectString: db_service
      ? `${db_host}/${db_service}`
      : db_host || process.env.ORACLE_CONNECT_STRING,
    privilege: oracledb.SYSDBA,
  };
}

async function getConn(body) {
  return oracledb.getConnection(getDbConfig(body));
}

async function pushAllInSingleCommit(kit, owner, repo, sessions, folder = "") {
  const branch = "main";

  const { data: refData } = await kit.request(
    "GET /repos/{owner}/{repo}/git/ref/heads/{branch}",
    { owner, repo, branch }
  );

  const latestCommitSha = refData.object.sha;

  const { data: commitData } = await kit.request(
    "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
    { owner, repo, commit_sha: latestCommitSha }
  );

  const baseTreeSha = commitData.tree.sha;

  const treeItems = [];
  const files = [];

  for (const [sessNo, content] of Object.entries(sessions)) {
    const filename = `session_${sessNo}.txt`;
    const fullPath = folder ? `${folder}/${filename}` : filename;

    const { data: blob } = await kit.request(
      "POST /repos/{owner}/{repo}/git/blobs",
      {
        owner,
        repo,
        content,
        encoding: "utf-8",
      }
    );

    treeItems.push({
      path: fullPath,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    });

    files.push({
      file: filename,
      path: fullPath,
      url: `https://github.com/${owner}/${repo}/blob/main/${fullPath}`
    });
  }

  const { data: newTree } = await kit.request(
    "POST /repos/{owner}/{repo}/git/trees",
    {
      owner,
      repo,
      base_tree: baseTreeSha,
      tree: treeItems,
    }
  );

  const { data: newCommit } = await kit.request(
    "POST /repos/{owner}/{repo}/git/commits",
    {
      owner,
      repo,
      message: `ODI export (${files.length} sessions)`,
      tree: newTree.sha,
      parents: [latestCommitSha],
    }
  );

  await kit.request(
    "PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}",
    {
      owner,
      repo,
      branch,
      sha: newCommit.sha,
    }
  );

  return {
    commit: newCommit.sha,
    commit_url: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
    files
  };
}

// rows → { sessNo: "content string" }
function groupBySession(rows) {
  const sessions = {};
  for (const row of rows) {
    if (!sessions[row.SESS_NO]) sessions[row.SESS_NO] = "";
    sessions[row.SESS_NO] +=
      `SCEN_TASK_NO in {${row.SCEN_TASK_NO}}\n${row.COL_TXT || ""}\n${row.DEF_TXT || ""}\n`;
  }
  return sessions;
}

async function ensureRepo(kit, owner, repo) {
  try {
    await kit.request("GET /repos/{owner}/{repo}", { owner, repo });
  } catch (e) {
    if (e.status === 404) {
      await kit.request("POST /user/repos", {
        name: repo,
        private: false,
        auto_init: true,
      });
      await new Promise((r) => setTimeout(r, 2000));
    } else throw e;
  }
}

async function getSha(kit, owner, repo, repoPath) {
  try {
    const res = await kit.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner,
      repo,
      path: repoPath,
    });
    return res.data.sha;
  } catch {
    return undefined;
  }
}

// push raw string content directly — no local file needed
async function pushContent(kit, owner, repo, filename, content, folder) {
  const repoPath = folder ? `${folder}/${filename}` : filename;
  const encoded = Buffer.from(content).toString("base64");
  const sha = await getSha(kit, owner, repo, repoPath);
  await kit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    owner,
    repo,
    path: repoPath,
    message: `ODI export: ${filename}`,
    content: encoded,
    ...(sha ? { sha } : {}),
  });
  return `https://github.com/${owner}/${repo}/blob/main/${repoPath}`;
}

// push all sessions in parallel batches
async function pushSessions(
  kit,
  owner,
  repo,
  sessions,
  folder,
  concurrency = 5,
) {
  const entries = Object.entries(sessions); // [[sessNo, content], ...]
  const results = [];
  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency);
    const done = await Promise.allSettled(
      batch.map(([sessNo, content]) =>
        pushContent(kit, owner, repo, `session_${sessNo}.txt`, content, folder),
      ),
    );
    for (let j = 0; j < done.length; j++) {
      const name = `session_${batch[j][0]}.txt`;
      results.push(
        done[j].status === "fulfilled"
          ? { file: name, status: "ok", url: done[j].value }
          : { file: name, status: "fail", error: done[j].reason?.message },
      );
    }
  }
  return results;
}

// ── ROUTE 1 — POST /oracle/test ────────────────────────────────────────────
// Body: { db_user, db_pass, db_host, db_service? }
router.post("/test", async (req, res) => {
  let conn;
  try {
    conn = await getConn(req.body || {});
    const result = await conn.execute(
      "SELECT COUNT(*) CNT FROM DEV_ODI_REPO.SNP_SESSION",
    );
    res.json({ connected: true, sessions: result.rows[0][0] });
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// ── ROUTE 2 — POST /oracle/github/push-all ────────────────────────────────
// Push ALL sessions directly Oracle → GitHub (no local files)
// Body: { db_user, db_pass, db_host, db_service?, gh_token, gh_owner, gh_repo, gh_folder? }
router.post("/github/push-all", async (req, res) => {
  const { db_user, db_pass, db_host, db_service,
          gh_token, gh_owner, gh_repo, gh_folder } = req.body || {};

  if (!gh_token || !gh_owner || !gh_repo)
    return res.status(400).json({ error: "gh_token, gh_owner, gh_repo required" });

  let conn;
  try {
    conn = await getConn({ db_user, db_pass, db_host, db_service });

    const result = await conn.execute(
      `SELECT s.SESS_NO, l.SCEN_TASK_NO, l.DEF_TXT, l.COL_TXT
       FROM DEV_ODI_REPO.SNP_SESSION s
       JOIN DEV_ODI_REPO.SNP_SESS_TASK_LOG l ON s.SESS_NO = l.SESS_NO
       ORDER BY s.SESS_NO, l.SCEN_TASK_NO`
    );

    if (!result.rows.length)
      return res.json({ message: "No sessions found." });

    const sessions = groupBySession(result.rows);

    const kit = new Octokit({ auth: gh_token });

    await ensureRepo(kit, gh_owner, gh_repo);

    const response = await pushAllInSingleCommit(
      kit,
      gh_owner,
      gh_repo,
      sessions,
      gh_folder
    );

    res.json(response);

  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// ── ROUTE 3 — POST /oracle/github/push-latest ─────────────────────────────
// Push only latest session per scenario directly Oracle → GitHub
// Body: { db_user, db_pass, db_host, db_service?, gh_token, gh_owner, gh_repo, gh_folder? }
router.post("/github/push-latest", async (req, res) => {
  const {
    db_user,
    db_pass,
    db_host,
    db_service,
    gh_token,
    gh_owner,
    gh_repo,
    gh_folder,
  } = req.body || {};

  if (!gh_token || !gh_owner || !gh_repo)
    return res
      .status(400)
      .json({ error: "gh_token, gh_owner, gh_repo required" });

  let conn;
  try {
    conn = await getConn({ db_user, db_pass, db_host, db_service });
    const result = await conn.execute(
      `SELECT s.SESS_NO, s.SCEN_NAME, l.SCEN_TASK_NO, l.DEF_TXT, l.COL_TXT
       FROM DEV_ODI_REPO.SNP_SESSION s
       JOIN DEV_ODI_REPO.SNP_SESS_TASK_LOG l ON s.SESS_NO = l.SESS_NO
       WHERE s.SESS_STATUS = 'D'
         AND s.SESS_NO IN (
           SELECT SESS_NO FROM (
             SELECT SESS_NO,
                    ROW_NUMBER() OVER (PARTITION BY SCEN_NAME ORDER BY SESS_BEG DESC) rn
             FROM DEV_ODI_REPO.SNP_SESSION
           ) WHERE rn = 1
         )
       ORDER BY s.SESS_NO, l.SCEN_TASK_NO`,
    );

    if (!result.rows.length)
      return res.json({ message: "No completed sessions found." });

    const sessions = groupBySession(result.rows);
    const kit = new Octokit({ auth: gh_token });
    await ensureRepo(kit, gh_owner, gh_repo);
    const results = await pushSessions(
      kit,
      gh_owner,
      gh_repo,
      sessions,
      gh_folder,
    );

    res.json({
      total: results.length,
      ok: results.filter((r) => r.status === "ok").length,
      failed: results.filter((r) => r.status === "fail").length,
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// ── ROUTE 4 — POST /oracle/github/push/:session_no ────────────────────────
// Push one specific session directly Oracle → GitHub
// Body: { db_user, db_pass, db_host, db_service?, gh_token, gh_owner, gh_repo, gh_folder? }
router.post("/github/push/:session_no", async (req, res) => {
  const session_no = Number(req.params.session_no);
  if (isNaN(session_no))
    return res.status(400).json({ error: "session_no must be a number" });

  const {
    db_user,
    db_pass,
    db_host,
    db_service,
    gh_token,
    gh_owner,
    gh_repo,
    gh_folder,
  } = req.body || {};

  if (!gh_token || !gh_owner || !gh_repo)
    return res
      .status(400)
      .json({ error: "gh_token, gh_owner, gh_repo required" });

  let conn;
  try {
    conn = await getConn({ db_user, db_pass, db_host, db_service });
    const result = await conn.execute(
      `SELECT SESS_NO, SCEN_TASK_NO, DEF_TXT, COL_TXT
       FROM DEV_ODI_REPO.SNP_SESS_TASK_LOG
       WHERE SESS_NO = :sess
       ORDER BY SCEN_TASK_NO`,
      { sess: session_no },
    );

    if (!result.rows.length)
      return res
        .status(404)
        .json({ error: `No rows for session ${session_no}` });

    const sessions = groupBySession(result.rows);
    const kit = new Octokit({ auth: gh_token });
    await ensureRepo(kit, gh_owner, gh_repo);
    const url = await pushContent(
      kit,
      gh_owner,
      gh_repo,
      `session_${session_no}.txt`,
      sessions[session_no],
      gh_folder,
    );

    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

router.post("/check", async (req, res) => {
  let conn;
  try {
    conn = await getConn(req.body || {});
    await conn.execute("SELECT 1 FROM DUAL");
    res.json({ ok: true, message: "Connection successful" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

export default router;
