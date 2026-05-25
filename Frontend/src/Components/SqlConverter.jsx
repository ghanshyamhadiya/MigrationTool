import React, { useState, useRef } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vs } from "react-syntax-highlighter/dist/esm/styles/prism";
import { generateGemini } from "../services/geminiService";
import "./SqlConverter.css";
import appLogo from "../assets/image.png";
import { IoCode } from "react-icons/io5";
import { IoIosInformationCircleOutline } from "react-icons/io";
import { BsChatLeft } from "react-icons/bs";
import { BiUser } from "react-icons/bi";
//import { CgProfile } from "react-icons/cg";
import { FiSettings } from "react-icons/fi";
// import About from "./About";
import About1 from "./About1";
import Info from "./Info";
import Chat from "./Chat";
import Profile from "./Profile";
import Convert from "./Convert";
import Plugins from "./Plugins";
import {showSuccess, showError } from "../utils/toast";
// import { CONVERSION_TYPES } from "../constants/conversionTypes";

export function getConversionType(source, target, outputFormat) {
  if (source === "sql" && target === "sparksql" && outputFormat === "ipynb") return "sql-sparksql";
  if (source === "plsql" && target === "sparksql" && outputFormat === "ipynb") return "plsql-sparksql";
  if (source === "sql" && target === "pyspark" && outputFormat === "ipynb") return "sql-pyspark";
  if (source === "plsql" && target === "pyspark" && outputFormat === "ipynb") return "plsql-pyspark";
  return "sql-sparksql";
}

// function notebookToPython(notebookJson) {
//   try {
//     const nb =
//       typeof notebookJson === "string" ? JSON.parse(notebookJson) : notebookJson;
//     const lines = [];
//     (nb.cells || []).forEach((cell) => {
//       const src = Array.isArray(cell.source)
//         ? cell.source.join("")
//         : cell.source || "";
//       if (cell.cell_type === "markdown") {
//         src.split("\n").forEach((l) => lines.push(`# ${l}`));
//       } else {
//         lines.push(src);
//       }
//       lines.push("");
//     });
//     return lines.join("\n");
//   } catch {
//     return "# Could not convert notebook to Python";
//   }
// }

export default function App() {
  const [sqlText, setSqlText] = useState("");
  const [ipynbText, setIpynbText] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const timerRef = useRef(null);
  const [activePage, setActivePage] = useState("Home");
  // const [conversionType, setConversionType] = useState("sql-sparksql");
  const [sourceType, setSourceType] = useState("sql");
  const [targetType, setTargetType] = useState("sparksql");
  const [outputFormat, setOutputFormat] = useState("ipynb");

  const storedUser = JSON.parse(localStorage.getItem("user"));
  const userName = storedUser?.name || "User";

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
 
    setSelectedFile(file);

    const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, "");
    setFileName(nameWithoutExtension);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setSqlText(ev.target.result);
      setIpynbText("");
      setSeconds(0);
    };
    reader.readAsText(file);
  };

  const handleConvert = async () => {
    if (!selectedFile) return;

    setIsConverting(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);

    try {
      const data = await generateGemini(selectedFile, getConversionType(sourceType, targetType, outputFormat));
      //setIpynbText(data);
      setIpynbText(JSON.stringify(data, null, 2));
    } catch (error) {
      console.log("FULL ERROR:", error.response);
      showError(
        error.response?.data?.error || error.response?.data || error.message,
      );
    } finally {
      clearInterval(timerRef.current);
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (!ipynbText) return;

    if (outputFormat === "ipynb"){

    const blob = new Blob([ipynbText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName ? `${fileName}.ipynb` : "converted_spark.ipynb";
    a.click();
    URL.revokeObjectURL(url);
  }else{

  // const handleDownloadPy = () => {
  // if (!ipynbText) return;
  const content = notebookToPython(ipynbText);
  const blob = new Blob([content], { type: "text/x-python" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName ? `${fileName}.py` : "converted_spark.py";
  a.click();
  URL.revokeObjectURL(url);
}
};


  return (
    <div className="app-container">
      <div className="header-banner">
        <img src={appLogo} alt="App Logo" className="header-logo" />
        <h1 className="header-title">SQL~SparkSQL Code Migration</h1>
      </div>
      <div className="center-part">
        <div className="sidebar-slim">
          <div
            title="Home"
            className={`sidebar-icon-wrapper ${activePage === "Home" ? "active" : ""}`}
            onClick={() => setActivePage("Home")}
          >
            <IoCode size={24} />
          </div>
          <div
            title="Plugins"
            className={`sidebar-icon-wrapper ${activePage === "Plugins" ? "active" : ""}`}
            onClick={() => setActivePage("Plugins")}
          >
            <FiSettings size={24} />
          </div>
          <div
            title="Convert"
            className={`sidebar-icon-wrapper ${activePage === "Convert" ? "active" : ""}`}
            onClick={() => setActivePage("Convert")}
          >
            <IoCode size={24} />
          </div>
          {/* <div
            title="About"
            className={`sidebar-icon-wrapper ${activePage === "About" ? "active" : ""}`}
            onClick={() => setActivePage("About")}
          >
            <BiUser size={24} />
          </div> */}
          <div
            title="About1"
            className={`sidebar-icon-wrapper ${activePage === "About1" ? "active" : ""}`}
            onClick={() => setActivePage("About1")}
          >
            <BiUser size={24} />
          </div>
          <div
            title="Info"
            className={`sidebar-icon-wrapper ${activePage === "Info" ? "active" : ""}`}
            onClick={() => setActivePage("Info")}
          >
            <IoIosInformationCircleOutline size={24} />
          </div>
          <div
            title="Chat"
            className={`sidebar-icon-wrapper ${activePage === "Chat" ? "active" : ""}`}
            onClick={() => setActivePage("Chat")}
          >
            <BsChatLeft size={24} />
          </div>
          <div
            className="sidebar-bottom-group"
            style={{ marginTop: "auto", marginBottom: "15px" }}
          >
            <div
              title="Profile"
              className={`sidebar-icon-wrapper ${activePage === "Profile" ? "active" : ""}`}
              onClick={() => setActivePage("Profile")}
            >
              <div className="sidebar-avatar-letter">
                {userName.charAt(0).toUpperCase()}
              </div>
              {/* <CgProfile size={24} /> */}
            </div>
          </div>
        </div>

        <div className="page-wrapper">
          {activePage === "Profile" && <Profile />}
          {/* {activePage === "About" && <About />} */}
          {activePage === "About1" && <About1 />}
          {activePage === "Info" && <Info />}
          {activePage === "Convert" && <Convert />}
          {activePage === "Plugins" && <Plugins />}

          {(activePage === "Home" || activePage === "Chat") && (
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                flexGrow: 1,
                overflow: "hidden",
              }}
            >
              {activePage === "Chat" && <Chat />}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flexGrow: 1,
                  overflow: "hidden",
                }}
              >
                <div className="control-bar">
                  {/* <div className="control-left">
                    <div className="upload-wrapper">
                      <label className="btn btn-convert">
                        Upload .txt
                        <input
                          type="file"
                          accept=".txt"
                          onChange={handleUpload}
                          style={{ display: "none" }}
                        />
                      </label>
                      <span className="file-name-label">
                        {fileName ? `📄 ${fileName}.txt` : "No file selected"}
                      </span>
                    </div>
                  </div> */}
                  <div className="control-left">
                    <div className="upload-wrapper">
                      <select
                        className="conversion-type-select"
                        value={sourceType}
                        onChange={(e) => setSourceType(e.target.value)}
                        disabled={isConverting}
                      >
                        <option value="sql">SQL</option>
                        <option value="plsql">PL/SQL</option>
                      </select>
                      <label className="btn btn-convert">
                        Upload .txt
                        <input
                          type="file"
                          accept=".txt"
                          onChange={handleUpload}
                          style={{ display: "none" }}
                        />
                      </label>
                      <span className="file-name-label">
                        {fileName ? `📄 ${fileName}.txt` : "No file selected"}
                      </span>
                    </div>
                  </div>
                  {/* <div className="control-center">
                    <button
                      className="btn btn-convert"
                      onClick={handleConvert}
                      disabled={!sqlText || isConverting}
                    >
                      {isConverting ? "Converting..." : "Convert!"}
                    </button>
                    <span className="time-tracker">
                      {isConverting ? (
                        <>⚡ Igniting Spark... {seconds}s</>
                      ) : seconds > 0 ? (
                        <>🚀 Sparked in {seconds}s!</>
                      ) : (
                        <>⏱️ Ready to ignite</>
                      )}
                    </span>
                  </div> */}

                  <div className="control-center">
                    {/* <select
                      className="conversion-type-select"
                      value={conversionType}
                      onChange={(e) => setConversionType(e.target.value)}
                      disabled={isConverting}
                    >
                      {CONVERSION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select> */}
                    <select
                      className="conversion-type-select"
                      value={targetType}
                      onChange={(e) => setTargetType(e.target.value)}
                      disabled={isConverting}
                    >
                      <option value="sparksql">SparkSQL</option>
                      <option value="pyspark">PySpark</option>
                    </select>

                    <div style={{ display: "flex", gap: "18px", alignItems: "center", marginTop: "4px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: "#193450", fontWeight: "bold" }}>
                        <input
                          type="radio"
                          name="outputFormat"
                          value="ipynb"
                          checked={outputFormat === "ipynb"}
                          onChange={() => setOutputFormat("ipynb")}
                          style={{ accentColor: "#2e6296", width: "16px", height: "16px" }}
                        />
                        .ipynb
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", color: "#193450", fontWeight: "bold" }}>
                        <input
                          type="radio"
                          name="outputFormat"
                          value="py"
                          checked={outputFormat === "py"}
                          onChange={() => setOutputFormat("py")}
                          style={{ accentColor: "#2e6296", width: "16px", height: "16px" }}
                        />
                        .py
                      </label>
                    </div>

                    <button
                      className="btn btn-convert"
                      onClick={handleConvert}
                      disabled={!sqlText || isConverting}
                    >
                      {isConverting ? "Converting..." : "Convert!"}
                    </button>
                    <span className="time-tracker">
                      {isConverting ? (
                        <>⚡ Igniting Spark... {seconds}s</>
                      ) : seconds > 0 ? (
                        <>🚀 Sparked in {seconds}s!</>
                      ) : (
                        <>⏱️ Ready to ignite</>
                      )}
                    </span>
                  </div>

                  {/* <div className="control-right">
                    <button
                      className="btn btn-convert"
                      onClick={handleDownload}
                      disabled={!ipynbText}
                    >
                      Download .ipynb
                    </button>
                  </div> */}
                  <div className="control-right" style={{ gap: "10px" }}>
                    <button
                      className="btn btn-convert"
                      onClick={handleDownload}
                      disabled={!ipynbText}
                    >
                      Download {outputFormat === "ipynb" ? ".ipynb" : ".py"}
                    </button>
                    {/* <button
                      className="btn btn-convert"
                      onClick={handleDownloadPy}
                      disabled={!ipynbText}
                    >
                      Download .py
                    </button> */}
                  </div>
                </div>

                <div className="divider"></div>

                <div className="workspace">
                  <div className="pane">
                    <div className="pane-content">
                      <SyntaxHighlighter
                        language="sql"
                        style={vs}
                        wrapLongLines={false}
                        className="syntax-highlighter-custom"
                        showLineNumbers={true}
                        lineNumberStyle={{
                          minWidth: "3em",
                          paddingRight: "1em",
                          color: "#999",
                          textAlign: "right",
                        }}
                      >
                        {sqlText ||
                          "-- Your uploaded .txt file content will appear here..."}
                      </SyntaxHighlighter>
                    </div>
                  </div>

                  <div className="pane">
                    <div className="pane-content">
                      {/* <textarea
                        className="pane-textarea"
                        value={ipynbText}
                        readOnly
                        placeholder="Converted .ipynb code will appear here..."
                      /> */}
                      <SyntaxHighlighter
                        language={outputFormat === "ipynb" ? "json" : "python"}
                        style={vs}
                        showLineNumbers={true}
                        className="syntax-highlighter-custom"
                      >
                        {ipynbText ||
                          "Converted .ipynb code will appear here..."}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="footer-bar">
            <p>
              &copy; {new Date().getFullYear()} Flytics. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
