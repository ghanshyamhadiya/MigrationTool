export function parseToNotebook(text) {
  if (!text || typeof text !== "string") {
    throw new Error("AI returned empty or invalid response — cannot parse notebook");
  }

  let cleaned = text.trim();

  // Strip markdown fences if AI wrapped output
  cleaned = cleaned
    .replace(/^```(?:json|python|ipynb)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  const jsonStart = cleaned.indexOf("{");
  const jsonEnd   = cleaned.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1) return buildNotebookFromCode(cleaned);

  cleaned = cleaned.slice(jsonStart, jsonEnd + 1);

  let notebook;
  try {
    notebook = JSON.parse(cleaned);
  } catch {
    return buildNotebookFromCode(text.trim());
  }

  if (!notebook.cells || !Array.isArray(notebook.cells))
    return buildNotebookFromCode(text.trim());

  // ── Metadata — match reference format exactly ──────────────────────────────
  notebook.nbformat       = 4;
  notebook.nbformat_minor = 5;  // always 5, not whatever AI returns
  notebook.metadata       = notebook.metadata ?? {};

  notebook.metadata.kernelspec = {
    display_name: "Python 3",
    language:     "python",
    name:         "python3",
  };
  notebook.metadata.language_info = {
    name:    "python",
    version: "3.10.0",
  };
  // Preserve Databricks-specific metadata title if present, otherwise leave out
  if (notebook.metadata["application/vnd.databricks.v1+cell"]) {
    // already there — keep it
  }

  // ── Cells ──────────────────────────────────────────────────────────────────
  notebook.cells = notebook.cells.map((cell) => {
    // Only keep metadata key — no extra keys
    const normalizedCell = {
      cell_type: cell.cell_type,
      metadata:  {},
      source:    normalizeSource(cell.source, cell.cell_type),
    };

    if (cell.cell_type === "code") {
      normalizedCell.outputs         = [];
      normalizedCell.execution_count = null;
    }

    return normalizedCell;
  });

  return notebook;
}

// ── Source normalization ───────────────────────────────────────────────────────
// Reference format: array of strings, each line ends with \n EXCEPT the last line
function normalizeSource(source, cellType) {
  let text = "";

  if (Array.isArray(source)) {
    text = source.join("");
  } else if (typeof source === "string") {
    text = source;
  } else {
    return [];
  }

  // For code cells with no newlines (AI returned single-line blob), reformat
  if (cellType === "code") text = fixSqlNewlines(text);

  const lines = text.split("\n");

  // Remove trailing empty line that split() creates when text ends with \n
  if (lines[lines.length - 1] === "") lines.pop();

  // Re-attach \n to every line except the last — exact reference format
  return lines.map((line, i) => (i < lines.length - 1 ? line + "\n" : line));
}

// ── Fix SQL cells that AI returned as one long line ───────────────────────────
function fixSqlNewlines(code) {
  const newlineRatio = (code.match(/\n/g) || []).length / code.length;
  if (newlineRatio > 0.02) return code; // already well-formatted

  return code
    .replace(/;\s*/g, ";\n\n")
    .replace(
      /\s+(SELECT|INSERT|UPDATE|DELETE|MERGE|CREATE|DROP|WITH|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|WHEN|THEN|SET|ON|AND|OR|GROUP BY|ORDER BY|HAVING|UNION|OPTIMIZE|ZORDER)\s+/gi,
      (match, keyword) => `\n${keyword} `
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Fallback: wrap raw text in a single code cell ─────────────────────────────
function buildNotebookFromCode(code) {
  const lines = code.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  const source = lines.map((l, i) => (i < lines.length - 1 ? l + "\n" : l));

  return {
    nbformat:       4,
    nbformat_minor: 5,
    metadata: {
      kernelspec:    { display_name: "Python 3", language: "python", name: "python3" },
      language_info: { name: "python", version: "3.10.0" },
    },
    cells: [
      {
        cell_type:       "code",
        metadata:        {},
        outputs:         [],
        execution_count: null,
        source,
      },
    ],
  };
}