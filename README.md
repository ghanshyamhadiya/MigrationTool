# ETL Code Migration Tool

> Converts Oracle SQL / PL/SQL into PySpark or SparkSQL using AI — input from Oracle SQL Developer sessions or `.sql` files.

---

## Overview

| | |
|---|---|
| **Input** | Oracle SQL Developer session SQL or `.sql` file upload |
| **Output** | PySpark DataFrame API or SparkSQL |
| **AI Engine** | Anthropic API / OpenAI API / Gemini API |
| **Instruction Source** | GitHub-hosted markdown files (fetched at runtime) |

---

## Features

- Convert PL/SQL blocks → PySpark
- Convert Oracle SQL → PySpark or SparkSQL
- User selects source type and target dialect at runtime
- Instruction files loaded dynamically from GitHub — no redeployment needed to update rules
- Handles Oracle-specific syntax with no clean Spark equivalent

---

## Supported Conversions

| Oracle Syntax | PySpark / SparkSQL Equivalent |
|---|---|
| `NVL(col, 0)` | `coalesce(col, 0)` |
| `DECODE(col, val, res)` | `CASE WHEN col = val THEN res END` |
| `ROWNUM` | `row_number() OVER (ORDER BY ...)` |
| `SYSDATE` | `current_date()` |
| `TO_DATE('str', 'fmt')` | `to_date('str', 'fmt')` |
| PL/SQL cursor loops | PySpark DataFrame iteration |
| `CONNECT BY` hierarchy | Recursive CTE / DataFrame joins |

---

## Architecture

```
┌──────────────────────────────┐
│         User Input           │
│  Session SQL  /  .sql file   │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│      Select Target Dialect   │
│   [ PySpark ]  [ SparkSQL ]  │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│   Fetch Instruction File     │
│   from GitHub at runtime     │
│                              │
│  plsql_to_pyspark.md         │
│  sql_to_pyspark.md           │
│  sql_to_sparksql.md          │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│     Anthropic / OpenAI API   │
│  SQL + Instructions → Output │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│    PySpark / SparkSQL Code   │
└──────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, Node.js |
| AI | Anthropic API, OpenAI API |
| Data | PySpark, SparkSQL, Oracle SQL, ODI |
| Instruction Hosting | GitHub (markdown files) |
| Input Source | Oracle SQL Developer |

---

## Installation

```bash
git clone https://github.com/ghanshyamhadiya/<repo-name>
cd <repo-name>
pip install -r requirements.txt
```

Create a `.env` file in the root:

```env
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
```

Run:

```bash
python main.py
```

---

## Instruction Files

it's private and confidencial

To update a rule — edit the markdown file. No code changes required.

---

## Usage

**Step 1** — Choose input source:
- Paste SQL from Oracle SQL Developer session
- Upload a `.sql` file

**Step 2** — Select target:
- `PySpark` — DataFrame API output
- `SparkSQL` — SQL-compatible Spark syntax

**Step 3** — Tool fetches the correct instruction file from GitHub and sends both to the AI API.

**Step 4** — Receive converted code output.

---

## Roadmap

- [ ] Batch conversion for multiple `.sql` files
- [ ] Output syntax validation before returning result
- [ ] Expanded PL/SQL stored procedure support
- [ ] Support for additional Oracle-specific functions
- [ ] Web UI for non-technical users

---

## Author

**Ghanshyam Hadiya**
B.E. Information Technology — Ahmedabad Institute of Technology (May 2026)
Data Consultant Trainee @ Flytics

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/ghanshyam-hadiya-13971b2bb/)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat&logo=github&logoColor=white)](https://github.com/ghanshyamhadiya)
[![Portfolio](https://img.shields.io/badge/Portfolio-000000?style=flat&logo=vercel&logoColor=white)](https://ghanshyam-hadiya0.vercel.app/)

---

## License

MIT
