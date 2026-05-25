import { GoogleGenerativeAI } from "@google/generative-ai";
import { Octokit } from "@octokit/core";
import fs from "fs";

const GEN_API_KEY = process.env.GEMINI_API_KEY;
const genModel = "gemini-3-flash-preview";
const genAi = new GoogleGenerativeAI(GEN_API_KEY);

console.log(`[gemini.service] Initialized with model: ${genModel} and API key: ${GEN_API_KEY}`);

// Shared system instruction for all conversion calls
const CONVERSION_SYSTEM = `Follow SAMPLE instructions exactly. Convert TARGET to Databricks Spark SQL Jupyter Notebook.
Return ONLY valid .ipynb JSON. No markdown fences. No explanation. No extra text.
Output the notebook ONCE and then stop immediately. Do not repeat or attempt a second version.`;

const _cache = new Map();
export function loadInstructions(filepath, name) {
  _cache.set(name, fs.readFileSync(filepath, "utf-8"));
  console.log(
    `[gemini] instructions["${name}"] loaded from file: ${_cache.get(name).length} chars`,
  );
}

export async function loadInstructionsFromGitHub(
  { owner, repo, path, branch = "main" },
  name,
) {
  const octokit = new Octokit({ auth: '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' });
  const { data } = await octokit.request(
    "GET /repos/{owner}/{repo}/contents/{path}",
    {
      owner,
      repo,
      path,
      ref: branch,
    },
  );
  const text = Buffer.from(data.content, "base64").toString("utf-8");
  _cache.set(name, text);
  console.log(
    `[gemini] instructions["${name}"] loaded from GitHub (${owner}/${repo}/${path}): ${text.length} chars`,
  );
  return text;
}
export function getCacheStatus() {
  const sets = {};
  for (const [name, text] of _cache.entries()) {
    sets[name] = { instructionsLoaded: true, instructionsChars: text.length };
  }
  return sets;
}

export async function uploadToAi(localpath, mimeType) {
  const buffer = fs.readFileSync(localpath);

  const initRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${GEN_API_KEY}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": buffer.length,
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: { display_name: localpath.split("/").pop() },
      }),
    },
  );

  const uploadUrl = initRes.headers.get("x-goog-upload-url");

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Command": "upload, finalize",
      "X-Goog-Upload-Offset": "0",
      "Content-Length": buffer.length,
    },
    body: buffer,
  });

  if (!uploadRes.ok)
    throw new Error(`Gemini upload failed: ${await uploadRes.text()}`);

  const data = await uploadRes.json();
  return data.file.uri;
}

// Uses uploaded File URI — sample is cached server-side, not re-sent each call
export async function aiConvert(sampleFileUri, targetPath, prompt) {
  const startTime = Date.now();
  const targetBase64 = fs.readFileSync(targetPath).toString("base64");

  const model = genAi.getGenerativeModel({
    model: genModel,
    systemInstruction: CONVERSION_SYSTEM,
  });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: "SAMPLE (rules and examples — follow this):" },
          { fileData: { mimeType: "text/plain", fileUri: sampleFileUri } },
          { text: "\nTARGET to convert:\n" },
          { inlineData: { mimeType: "text/plain", data: targetBase64 } },
          {
            text:
              prompt ||
              "Convert TARGET to Databricks Spark SQL Jupyter Notebook. Return valid .ipynb JSON only.",
          },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 32768, // cap runaway output
    },
  });

  return _buildResult(result, Date.now() - startTime);
}

export async function aiConvert2(targetText, basePrompt, name) {
  const instructionsText = _cache.get(name);
  if (!instructionsText) throw new Error(`Instructions "${name}" not loaded`);

  const fullPrompt = `${basePrompt}\n\nSAMPLE INSTRUCTIONS:\n${instructionsText}\n\nTARGET FILE TO CONVERT:\n${targetText}`;
  const startTime = Date.now();

  const model = genAi.getGenerativeModel({
    model: genModel,
    systemInstruction: CONVERSION_SYSTEM,
  });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
    generationConfig: {
      maxOutputTokens: 65000,
    },
  });

  return _buildResult(result, Date.now() - startTime);
}

export async function generateFromText(prompt, modelName = "gemini-2.5-flash") {
  const model = genAi.getGenerativeModel({ model: modelName });
  const start = Date.now();

  const result = await model.generateContent(prompt);
  const usage = result.response.usageMetadata || {};
  const text = result.response.text?.() || "";

  if (!text.trim()) {
    const reason = result.response.candidates?.[0]?.finishReason || "UNKNOWN";
    throw new Error(`Empty response from Gemini (reason: ${reason})`);
  }

  return {
    text,
    stats: {
      timeTakenMs: Date.now() - start,
      inputTokens: usage.promptTokenCount ?? 0,
      outputTokens: usage.candidatesTokenCount ?? 0,
      totalTokens: usage.totalTokenCount ?? 0,
    },
  };
}

function _buildResult(result, timeTakenMs) {
  const usage = result.response.usageMetadata || {};
  const text = result.response.text();

  if (!text || typeof text !== "string" || text.trim() === "") {
    const reason = result.response.candidates?.[0]?.finishReason ?? "UNKNOWN";
    throw new Error(`Gemini returned empty response (finishReason: ${reason})`);
  }

  const stats = {
    timeTakenMs,
    inputTokens: usage.promptTokenCount ?? null,
    outputTokens: usage.candidatesTokenCount ?? null,
    totalTokens: usage.totalTokenCount ?? null,
    cachedTokens: 0,
  };

  _logStats(stats);
  return { text, stats };
}

function _logStats(stats) {
  console.log("─── Gemini Stats ──────────────────────────────");
  console.log(`  time    : ${(stats.timeTakenMs / 1000).toFixed(2)}s`);
  console.log(`  input   : ${stats.inputTokens}`);
  console.log(`  output  : ${stats.outputTokens}`);
  console.log(`  total   : ${stats.totalTokens}`);
  console.log("───────────────────────────────────────────────");
}
