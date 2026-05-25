import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getConversionLogs } from "../services/dbService";
import "./Profile.css";
import {
  FiUser,
  FiMail,
  FiSmartphone,
  FiLogOut,
  FiArrowLeft,
  FiFileText,
  FiAlertTriangle,
  FiList,
  FiHash,
  FiCheckCircle,
} from "react-icons/fi";

export default function Profile() {
  const navigate = useNavigate();
  // const [isEditing, setIsEditing] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [view, setView] = useState("info");
  const [logs, setLogs] = useState([]);

  const storedUser = JSON.parse(localStorage.getItem("user"));
  const userData = {
    name: storedUser?.name || "User",
    email: storedUser?.email || "N/A",
    mobile: storedUser?.mobile_number || "N/A",
  };

  const confirmLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  useEffect(() => {
    if (view === "logs") {
      const fetchUserLogs = async () => {
        try {
            const data = await getConversionLogs();
            setLogs(Array.isArray(data) ? data : []);
            // if (response.ok) setLogs(data);
        } catch (error) {
          console.error("Error fetching logs:", error);
        }
      };
      fetchUserLogs();
    }
  }, [view]);

  // const handleSave = (e) => {
  //   e.preventDefault();
  //   setIsEditing(false);
  // };

  return (
    <div className="profile-main-wrapper">
      {/* --- HEADER BLOCK --- */}
      <div className="profile-header-premium">
        <div className="profile-id-section">
          <div className="profile-letter-avatar">{userData.name.charAt(0)}</div>
          <div className="profile-name-stack">
            <h1>{userData.name}</h1>
            <span className="profile-tagline">
              {view === "info" ? userData.role : "Activity Logs & History"}
            </span>
          </div>
        </div>

        <div className="profile-header-actions">
          {/* {!isEditing ? (
            <button className="btn-modern edit-btn" onClick={() => setIsEditing(true)}>
              <FiEdit2 /> Edit Profile
            </button>
          ) : ( 
            <button className="btn-modern cancel-btn" onClick={() => setIsEditing(false)}>
              <FiX /> Cancel
            </button>
          )} */}
          {/* <button classname="btn-modern logs-btn" onc */}
          {view === "info" ? (
            <button
              className="btn-modern logs-btn"
              onClick={() => setView("logs")}
            >
              <FiList /> Activity Logs
            </button>
          ) : (
            <button
              className="btn-modern back-btn"
              onClick={() => setView("info")}
            >
              <FiArrowLeft /> Back to Profile
            </button>
          )}
          <button
            className="btn-modern logout-trigger-btn"
            onClick={() => {
              setShowLogoutModal(true);
            }}
          >
            <FiLogOut /> Logout
          </button>
        </div>
      </div>

      <div className="profile-body-content">
        {/* {!isEditing ? ( */}
        {view === "info" ? (
          <div className="profile-info-stack animate-fade-in">
            <div className="info-item-linear">
              <div className="info-icon-circle">
                <FiUser />
              </div>
              <div className="info-text-group">
                <label>Full Identity</label>
                <p>{userData.name}</p>
              </div>
            </div>
            <div className="info-item-linear">
              <div className="info-icon-circle">
                <FiMail />
              </div>
              <div className="info-text-group">
                <label>Registered Email</label>
                <p>{userData.email}</p>
              </div>
            </div>
            <div className="info-item-linear">
              <div className="info-icon-circle">
                <FiSmartphone />
              </div>
              <div className="info-text-group">
                <label>Mobile Contact</label>
                <p>{userData.mobile}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="profile-logs-master-container animate-fade-in">
            <div className="logs-scroll-viewport">
              <table className="logs-detailed-table">
                <thead>
                  <tr>
                    <th>
                      <FiHash /> ID
                    </th>
                    <th>
                      <FiFileText /> Input File
                    </th>
                    <th>
                      <FiCheckCircle /> Output File
                    </th>
                    <th>Input Tokens</th>
                    <th>Cached Tokens</th>
                    <th>Output Tokens</th>
                    <th>Total Tokens</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length > 0 ? (
                    logs.map((log, idx) => (
                      <tr key={idx}>
                        <td className="sticky-id">#{log.id}</td>
                        <td>{log.target_file_name}</td>
                        <td>{log.output_file_name}</td>
                        <td>{log.input_tokens}</td>
                        <td
                          className={
                            log.cached_tokens > 0 ? "highlight-cache" : ""
                          }
                        >
                          {log.cached_tokens || 0}
                        </td>
                        <td>{log.output_tokens}</td>
                        <td className="total-cell">{log.total_tokens}</td>
                        <td>
                          <b>{(log.time_taken_ms / 1000).toFixed(2)}s</b>
                        </td>
                        <td>
                          <span className={`status-pill ${log.status}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="date-cell">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="10" className="no-data-text">
                        No conversion records available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {/* ) : (
          <form
            className="profile-form-linear animate-slide-up"
            onSubmit={handleSave}
          >
            <div className="input-row-modern">
              <label>Full Name</label>
              <input
                type="text"
                value={userData.name}
                onChange={(e) =>
                  setUserData({ ...userData, name: e.target.value })
                }
              />
            </div>
            <div className="input-row-modern">
              <label>Email Address</label>
              <input
                type="email"
                value={userData.email}
                onChange={(e) =>
                  setUserData({ ...userData, email: e.target.value })
                }
              />
            </div>
            <div className="input-row-modern">
              <label>Mobile</label>
              <input
                type="text"
                value={userData.mobile}
                onChange={(e) =>
                  setUserData({ ...userData, mobile: e.target.value })
                }
              />
            </div>
            <button type="submit" className="save-submit-btn">
              <FiCheck /> Apply Changes
            </button>
          </form>
        )} */}

      {showLogoutModal && (
        <div className="modal-overlay">
          <div className="logout-modal-card">
            <div className="modal-warning-icon">
              <FiAlertTriangle />
            </div>
            <h2>Confirm Logout</h2>
            <p>
              Are you sure you want to end your current session? You will need
              to login again to access your workspace.
            </p>
            <div className="modal-btn-group">
              <button className="modal-btn confirm" onClick={confirmLogout}>
                Yes, Logout
              </button>
              <button
                className="modal-btn stay"
                onClick={() => setShowLogoutModal(false)}
              >
                Keep me here
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
