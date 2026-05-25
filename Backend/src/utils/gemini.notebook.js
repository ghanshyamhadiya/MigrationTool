export function parseGeminiNotebook(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("[parseGeminiNotebook] Received empty or non-string input");
  }

  let cleaned = rawText.trim();
  cleaned = cleaned.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
  cleaned = cleaned.replace(/^```(?:json|ipynb|python)?\s*\n?/, "");
  cleaned = cleaned.replace(/\n?```\s*$/, "").trim();

  let notebook;

  // Attempt 1: direct parse with tab sanitization
  try {
    notebook = JSON.parse(_sanitize(cleaned));
  } catch {
    // Attempt 2: extract only the first complete JSON object.
    // Handles Gemini double-output bug (two notebooks in one response).
    const first = _extractFirstObject(cleaned);
    if (first) {
      try { notebook = JSON.parse(_sanitize(first)); } catch {}
    }
  }

  // Attempt 3: strip all unescaped control characters
  if (!notebook) {
    try {
      // eslint-disable-next-line no-control-regex
      notebook = JSON.parse(cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ""));
    } catch (err) {
      console.error("[parseGeminiNotebook] JSON parse failed:", err.message);
      return _fallback(cleaned);
    }
  }

  if (!notebook || !Array.isArray(notebook.cells)) {
    return _fallback(cleaned);
  }

  notebook.nbformat       = 4;
  notebook.nbformat_minor = notebook.nbformat_minor ?? 5;
  notebook.metadata       = {
    kernelspec:    { display_name: "Python 3", language: "python", name: "python3" },
    language_info: { name: "python", version: "3.10.0" },
    ...(notebook.metadata ?? {}),
  };

  notebook.cells = notebook.cells.map(_normalizeCell);
  return notebook;
}

function _sanitize(text) {
  return text.replace(
    /"((?:[^"\\]|\\.)*)"/g,
    (match, inner) => `"${inner.replace(/\t/g, "\\t")}"`
  );
}

// Walk the string tracking brace depth to find the first complete {...} object.
// Stops at the closing } that brings depth back to 0, ignoring anything after.
function _extractFirstObject(text) {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth    = 0;
  let inString = false;
  let escape   = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape)                     { escape = false; continue; }
    if (ch === "\\" && inString)    { escape = true;  continue; }
    if (ch === '"')                 { inString = !inString; continue; }
    if (inString)                   continue;
    if (ch === "{")                 depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

function _normalizeCell(cell) {
  cell.metadata = cell.metadata ?? {};
  cell.source   = _normalizeSource(cell.source);

  if (cell.cell_type === "code") {
    cell.source          = _stripMagicPrefixes(cell.source);
    cell.outputs         = Array.isArray(cell.outputs) ? cell.outputs : [];
    cell.execution_count = cell.execution_count ?? null;
  } else {
    delete cell.outputs;
    delete cell.execution_count;
  }

  return cell;
}

function _normalizeSource(source) {
  let text = "";
  if (Array.isArray(source))           text = source.join("");
  else if (typeof source === "string") text = source;
  else return [];

  if (!text) return [];
  const lines = text.split("\n");
  return lines.map((line, i) => (i < lines.length - 1 ? line + "\n" : line));
}

function _stripMagicPrefixes(sourceLines) {
  let text = sourceLines.join("");

  text = text.replace(/^--\s*MAGIC\s+(%sql)\s*\n?/i,  "$1\n");
  text = text.replace(/^--\s*MAGIC\s+%python\s*\n?/i, "");
  text = text.replace(/\n--\s*MAGIC\s+(%sql)\s*\n/gi, "\n$1\n");
  text = text.replace(/\n--\s*MAGIC\s+%python\s*\n/gi, "\n");

  if (!text) return [];
  const lines = text.split("\n");
  return lines.map((line, i) => (i < lines.length - 1 ? line + "\n" : line));
}

function _fallback(rawText) {
  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec:    { display_name: "Python 3", language: "python", name: "python3" },
      language_info: { name: "python", version: "3.10.0" },
    },
    cells: [
      {
        cell_type: "markdown",
        metadata:  {},
        source: [
          "⚠️ **Gemini Parse Error** — response could not be parsed as a valid notebook.\n",
          "Raw output preserved below for manual recovery.",
        ],
      },
      {
        cell_type:       "code",
        metadata:        {},
        outputs:         [],
        execution_count: null,
        source:          _normalizeSource(rawText),
      },
    ],
  };
}