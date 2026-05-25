import fs from "fs";
import { Octokit } from "@octokit/rest";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CONVERT_MODEL = "claude-opus-4-6";
const CHAT_MODEL    = "claude-haiku-4-5-20251001";

const CHAT_SYSTEM = `You are a Databricks Spark SQL notebook editor.
Return the COMPLETE updated notebook JSON only. No markdown fences. No explanation.`;

const SYSTEM_INSTRUCTION = `SAMPLE file contains conversion rules. TARGET is the ODI SQL file to convert.
Return complete valid .ipynb JSON only. No markdown fences. No explanation.`;

const _cache = new Map();

export function loadInstructions(filepath, name) {
  _cache.set(name, fs.readFileSync(filepath, "utf-8"));
   console.log(`[claude] instructions["${name}"] loaded from file: ${_cache.get(name).length} chars`);
}

export async function loadInstructionsFromGitHub({ owner, repo, path, branch = "main" }, name) {
  const octokit = new Octokit({ auth: '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' });
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
    owner, repo, path, ref: branch,
  });
  const text = Buffer.from(data.content, "base64").toString("utf-8");
  _cache.set(name, text);
  console.log(`[claude] instructions["${name}"] loaded from GitHub (${owner}/${repo}/${path}): ${text.length} chars`);
  return text;
}

export function getCacheStatus() {
  const sets = {};
  for (const [name, text] of _cache.entries()) {
    sets[name] = { instructionsLoaded: true, instructionsChars: text.length };
  }
  return sets;
}

// accepts filepath OR raw text string
export async function aiConvert(targetInput, prompt, name) {
  const instructionsText = _cache.get(name)
  if (!instructionsText)
    throw new Error(`Instructions "${name}" not loaded`);

  const targetText  = (typeof targetInput === "string" && fs.existsSync(targetInput))
    ? fs.readFileSync(targetInput, "utf-8")
    : targetInput;

  const startTime = Date.now();

  const stream = await client.messages.stream({
    model:      CONVERT_MODEL,
    max_tokens: 50000,
    system: [
      {
        type:          "text",
        text:          SYSTEM_INSTRUCTION,
        // cache_control: { type: "ephemeral" },   // cache system prompt
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type:          "text",
            text:          `SAMPLE (follow strictly):\n\n${instructionsText}`,
            // cache_control: { type: "ephemeral", ttl: '1h' },
          },
          {
            type: "text",
            text: `\nTARGET to convert:\n\n${targetText}\n\n${prompt || "Convert to Databricks Spark SQL Jupyter Notebook. Return valid .ipynb JSON only."}`,
            // no cache_control — target changes every request
          },
        ],
      },
    ],
  });

  const response    = await stream.finalMessage();
  const timeTakenMs = Date.now() - startTime;
  const u           = response.usage;

  const stats = {
    timeTakenMs,
    inputTokens:      u.input_tokens                  ?? null,
    cachedTokens:     u.cache_read_input_tokens        ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens    ?? 0,
    outputTokens:     u.output_tokens                  ?? null,
    totalTokens:      (u.input_tokens ?? 0) + (u.output_tokens ?? 0),
  };

  console.log("─── Claude Stats ────────────────────────────");
  console.log(`  model        : ${CONVERT_MODEL}`);
  console.log(`  time         : ${(timeTakenMs / 1000).toFixed(2)}s`);
  console.log(`  cache write  : ${stats.cacheWriteTokens}`);
  console.log(`  cache read   : ${stats.cachedTokens}`);
  console.log(`  input        : ${stats.inputTokens}`);
  console.log(`  output       : ${stats.outputTokens}`);
  console.log(`  stop reason  : ${response.stop_reason}`);
  console.log("─────────────────────────────────────────────");

  if (response.stop_reason === "max_tokens")
    throw new Error(`Output truncated at ${u.output_tokens} tokens — notebook JSON incomplete.`);

  return { text: response.content[0].text, stats };
}

export async function chatNotebook(notebookJson, history, userMessage) {
  const notebookStr = JSON.stringify(notebookJson, null, 2);
  const messages    = [];

  if (history?.length > 0) {
    const [first, ...rest] = history;
    messages.push({
      role: "user",
      content: [
        {
          type:          "text",
          text:          `Here is the current notebook:\n\n${notebookStr}\n\nUser request: ${typeof first.content === "string" ? first.content : userMessage}`,
          cache_control: { type: "ephemeral" }, // cache notebook for multi-turn
        },
      ],
    });
    messages.push(...rest);
    messages.push({ role: "user", content: userMessage });
  } else {
    messages.push({
      role: "user",
      content: [
        {
          type:          "text",
          text:          `Here is the current notebook:\n\n${notebookStr}\n\nUser request: ${userMessage}`,
          cache_control: { type: "ephemeral" },
        },
      ],
    });
  }

  const response = await client.messages.create({
    model:      CHAT_MODEL,
    max_tokens: 8096,
    system:     CHAT_SYSTEM,
    messages,
  });

  const u = response.usage;
  console.log(`[chat] in: ${u.input_tokens} cached: ${u.cache_read_input_tokens ?? 0} out: ${u.output_tokens} stop: ${response.stop_reason}`);

  if (response.stop_reason === "max_tokens")
    throw new Error("Chat output truncated — try splitting your request.");

  return {
    text:         response.content[0].text,
    inputTokens:  u.input_tokens  ?? null,
    outputTokens: u.output_tokens ?? null,
  };
}