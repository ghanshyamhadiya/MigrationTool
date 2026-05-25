import React, { useState } from "react";
import { pushAllSessions } from "../services/oracleService";
import { convertFromGithub } from "../services/geminiService";
import { getConversionType } from "./Sqlconverter";
import {
  FiGithub,
  FiUploadCloud,
  FiCheckCircle,
  FiFileText,
  FiUser,
  FiBox,
  FiLock,
  FiDatabase,
  FiFolder,
  FiGitBranch,
  FiRefreshCw,
  FiZap,
} from "react-icons/fi";
import { showSuccess, showError } from "../utils/toast";
import "./Convert.css";

export default function Convert() {
  const [gitConfig, setGitConfig] = useState({
    srcOwner: "",
    srcRepo: "",
    srcBranch: "main",
    srcFolder: "",
    readerToken: "",
    destOwner: "",
    destRepo: "",
    destBranch: "main",
    destFolder: "notebooks",
    writerToken: "",
    isSameRepo: true,
  });

  const [sourceType, setSourceType] = useState("sql");
  const [targetType, setTargetType] = useState("sparksql");
  const [outputFormat, setOutputFormat] = useState("ipynb");

  // const [isProcessing, setIsProcessing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [pushedFiles, setPushedFiles] = useState([]);
  const [repositoryAssets, setRepositoryAssets] = useState([]);

  const handleGitPush = async () => {
    const dbCredentials = {
      db_user: "sys",
      db_pass: "12345678",
      db_host: "localhost:1521",
      db_service: "orcl",
    };
    if (!gitConfig.readerToken || !gitConfig.srcOwner || !gitConfig.srcRepo) {
      showError("Source credentials required for extraction.");
      return;
    }
    setIsExtracting(true);
    setPushedFiles([]);
    try {
      const data = await pushAllSessions({
        ...dbCredentials,
        gh_token: gitConfig.readerToken,
        gh_owner: gitConfig.srcOwner,
        gh_repo: gitConfig.srcRepo,
        gh_folder: gitConfig.srcFolder,
      });
      setRepositoryAssets(data.files.map((f) => f.file));
      for (const fileName of data.files.map((f) => f.file)) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        setPushedFiles((prev) => [...prev, fileName]);
      }
      showSuccess(
        `Successfully pushed ${data.files.length} ODI files to GitHub!`,
      );
    } catch (error) {
      showError(error.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConversion = async () => {
    const token = localStorage.getItem("token");
    if (
      !gitConfig.destOwner ||
      // !gitConfig.destRepo ||
      (!gitConfig.isSameRepo && !gitConfig.writerToken)
    ) {
      showError("Destination configuration incomplete.");
      return;
    }

    if (!token) {
      showError("Please login to perform conversion.");
      return;
    }
    setIsConverting(true);
    setPushedFiles([]);
    setRepositoryAssets([]);
    // try {
    //   const response = await fetch(
    //     "http://localhost:8080/gemini/convert-from-github",
    //     {
    //       method: "POST",
    //       headers: {
    //         "Content-Type": "application/json",
    //         Authorization: `Bearer ${token}`,
    //       },
    //       body: JSON.stringify({
    //         ...gitConfig,
    //         readerToken: gitConfig.readerToken,
    //         writerToken: gitConfig.isSameRepo
    //           ? gitConfig.readerToken
    //           : gitConfig.writerToken,
    //       }),
    //     },
    //   );
    //   const data = await response.json();

    //   // if (!response.ok) throw new Error(data.error || "Extraction failed");
    //   // setRepositoryAssets(data.files.map((f) => f.file));
    //   // for (const fileName of data.files.map((f) => f.file)) {
    //   //   await new Promise((resolve) => setTimeout(resolve, 100));
    //   //   setPushedFiles((prev) => [...prev, fileName]);
    //   // }
    //   // showSuccess(
    //   //   `Successfully pushed ${data.files.length} ODI files to GitHub!`,
    //   // );

    //   //  console.log("Backend Response:", data);

    //   if (!response.ok) throw new Error(data.error || "Transformation failed");

    //   // if (!response.ok) {
    //   //   // Specifically catch the database constraint error
    //   //   if (data.error && data.error.includes("check constraint")) {
    //   //     throw new Error("Database Error: Invalid status value sent to conversion_log.");
    //   //   }
    //   //   throw new Error(data.error || "Transformation failed");
    //   // }

    //   if (data.results && data.results.length > 0) {
    //     const allFiles = data.results.map((r) => r.trgName);

    //     // show all files in inventory
    //     setRepositoryAssets(allFiles);

    //     // push success files one by one
    //     for (const result of data.results) {
    //       if (result.status === "ok") {
    //         await new Promise((resolve) => setTimeout(resolve, 300));

    //         setPushedFiles((prev) => [...prev, result.trgName]);
    //       }
    //     }

    //     showSuccess(
    //       `Successfully Convert ${fileNames.length} .txt files to .ipynb and push in github!`,
    //     );
    //   } else {
    //     showError("Conversion successful, but file list is empty.");
    //   }
    // }
    try {
      const response = await convertFromGithub({
        ...gitConfig,
        readerToken: gitConfig.readerToken,
        writerToken: gitConfig.isSameRepo
          ? gitConfig.readerToken
          : gitConfig.writerToken,
      },
      () => getConversionType(sourceType, targetType, outputFormat),
    );

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let failedCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.replace("data: ", ""));

            if (data.trgName) {
              setRepositoryAssets((prev) => [...prev, data.trgName]);
            }
            if (data.status === "ok") {
              setPushedFiles((prev) => [...prev, data.trgName]);

              showSuccess(`${data.trgName} converted and pushed successfully`);
            }
            if (data.status === "failed") {
              showError(`Failed to convert ${data.trgName}`);
            }

            if (data.done) {
              if (failedCount > 0) {
                showError("Pipeline finished with some failed conversions.");
              } else {
                showSuccess("All files converted!");
              }
              return;
            }
          }
        }
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="git-push-view-container">
      <div className="git-push-scroll-area">
        <header className="git-push-hero">
          <h1 className="main-title">
            On-Prime to <span className="accent">Cloud auto migration tool</span>
          </h1>
          <p className="sub-title">
            End-to-end automated pipeline for Oracle ODI metadata extraction and
            Databricks notebook synthesis.
          </p>
        </header>

        <div className="nodes-wrapper">
          <div className="service-card large-config">
            <div className="card-header">
              <FiZap className="header-icon" />
              <h3>Migration Workflow Control</h3>
            </div>
            <div className="card-body">
              <div className="field-row">
                <div className="field">
                  <label>Source Access Token</label>
                  <div className="input-group">
                    <FiLock />
                    <input
                      type="password"
                      placeholder="ghp_source_xxx"
                      value={gitConfig.readerToken}
                      onChange={(e) =>
                        setGitConfig({
                          ...gitConfig,
                          readerToken: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                {!gitConfig.isSameRepo && (
                  <div className="field">
                    <label>Destination Access Token</label>
                    <div className="input-group">
                      <FiLock />
                      <input
                        type="password"
                        placeholder="ghp_dest_yyy"
                        value={gitConfig.writerToken}
                        onChange={(e) =>
                          setGitConfig({
                            ...gitConfig,
                            writerToken: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              <label className="checkbox-ui">
                <input
                  type="checkbox"
                  checked={gitConfig.isSameRepo}
                  onChange={(e) =>
                    setGitConfig({ ...gitConfig, isSameRepo: e.target.checked })
                  }
                />
                <span className="custom-box">
                  <FiCheckCircle />
                </span>
                <span className="label-text">
                  Synchronize destination token with source
                </span>
              </label>

              <div className="pipeline-grid">
                <div className="pipeline-col">
                  <div className="divider-label">Extraction Source</div>
                  <div className="field">
                    <label>Namespace</label>
                    <div className="input-group">
                      <FiUser />
                      <input
                        type="text"
                        placeholder="Owner"
                        value={gitConfig.srcOwner}
                        onChange={(e) =>
                          setGitConfig({
                            ...gitConfig,
                            srcOwner: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>Repository</label>
                    <div className="input-group">
                      <FiBox />
                      <input
                        type="text"
                        placeholder="Repo"
                        value={gitConfig.srcRepo}
                        onChange={(e) =>
                          setGitConfig({
                            ...gitConfig,
                            srcRepo: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>Target Path</label>
                    <div className="input-group">
                      <FiFolder />
                      <input
                        type="text"
                        placeholder="odi/src"
                        value={gitConfig.srcFolder}
                        onChange={(e) =>
                          setGitConfig({
                            ...gitConfig,
                            srcFolder: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="pipeline-col">
                  <div className="divider-label">Deployment Target</div>
                  <div className="field">
                    <label>Namespace</label>
                    <div className="input-group">
                      <FiUser />
                      <input
                        type="text"
                        placeholder="Owner"
                        value={gitConfig.destOwner}
                        onChange={(e) =>
                          setGitConfig({
                            ...gitConfig,
                            destOwner: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>Repository</label>
                    <div className="input-group">
                      <FiBox />
                      <input
                        type="text"
                        placeholder="Repo"
                        value={gitConfig.destRepo}
                        onChange={(e) =>
                          setGitConfig({
                            ...gitConfig,
                            destRepo: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>Output Path</label>
                    <div className="input-group">
                      <FiFolder />
                      <input
                        type="text"
                        placeholder="notebooks/"
                        value={gitConfig.destFolder}
                        onChange={(e) =>
                          setGitConfig({
                            ...gitConfig,
                            destFolder: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="action-stack">
                <button
                  className="primary-btn"
                  onClick={handleGitPush}
                  disabled={isExtracting}
                >
                  {isExtracting ? (
                    "Extracting..."
                  ) : (
                    <>
                      <FiUploadCloud /> Push On Git
                    </>
                  )}
                </button>
                <button
                  className="primary-btn secondary-btn"
                  onClick={handleConversion}
                  disabled={isConverting}
                >
                  {isConverting ? (
                    "Converting..."
                  ) : (
                    <>
                      <FiRefreshCw /> Convert
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="service-card assets-card">
            <div className="card-header">
              <FiDatabase className="header-icon" />
              <h3>Pipeline Inventory</h3>
              {repositoryAssets.length > 0 && (
                <span className="inv-chip-total">
                  {repositoryAssets.length} Converted
                </span>
              )}
            </div>

            {/* {repositoryAssets.length > 0 && (
              <div className="inv-summary">
                <div className="inv-counts">
                  <span className="inv-chip total">
                    {repositoryAssets.length} Total
                  </span>
                  <span className="inv-chip done">
                    <FiCheckCircle size={11} /> {pushedFiles.length} Done
                  </span>
                  {repositoryAssets.length - pushedFiles.length > 0 && (
                    <span className="inv-chip pend">
                      {repositoryAssets.length - pushedFiles.length} Pending
                    </span>
                  )}
                </div>
                <div className="inv-progress-row">
                  <div className="inv-track">
                    <div
                      className="inv-fill"
                      style={{
                        width: `${Math.round((pushedFiles.length / repositoryAssets.length) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="inv-pct">
                    {Math.round(
                      (pushedFiles.length / repositoryAssets.length) * 100,
                    )}
                    %
                  </span>
                </div>
              </div>
            )} */}

            <div className="card-body">
              <div className="file-display-zone grid-mode">
                <div className="file-grid-container">
                  {repositoryAssets.length === 0 &&
                    !isExtracting &&
                    !isConverting && (
                      <p className="empty-msg">
                        Pipeline standby. Start extraction to view files.
                      </p>
                    )}
                  {repositoryAssets.map((file, index) => (
                    <div
                      key={index}
                      className={`file-row-small ${pushedFiles.includes(file) ? "done" : ""}`}
                    >
                      <FiFileText className="file-icon" />
                      <span className="file-name">
                        {file.replace(/_\d+(?=\.ipynb)/i, "")}
                      </span>
                      {pushedFiles.includes(file) && (
                        <FiCheckCircle className="file-ok" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
