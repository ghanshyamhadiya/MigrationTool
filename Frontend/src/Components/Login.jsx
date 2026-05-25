import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../services/authService";
import "./Login.css";
import { FiMail, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import appLogo from "../assets/image.png";
import { showSuccess, showError } from "../utils/toast";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const data = await login({ email, password });
      if (data) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        navigate("/converter");
        showSuccess("Login successful! Redirecting...");
      } else {
        showError("Login failed. Please check your credentials.");
      }
    } catch (error) {
      console.error("Connection error:", error);
      showError("Unable to connect to the server. Please try again later.");
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-card">
        <div className="login-header">
          <img src={appLogo} alt="Flytics Logo" className="login-logo" />
          <h2>Welcome Back</h2>
          <p>Enter your credentials to access your workspace.</p>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="login-input-group">
            <FiMail className="login-input-icon" />
            <input
              type="text"
              placeholder="Email or Mobile Number"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="login-input-group">
            <FiLock className="login-input-icon" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div
              className="password-toggle-icon"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </div>
          </div>

          <div className="login-forgot-password">
            <a href="#forgot">Forgot Password?</a>
          </div>

          <button type="submit" className="login-submit-btn">
            Login to Workspace
          </button>
        </form>

        <div className="login-footer-link">
          Don't have an account?
          <Link to="/register">Register here</Link>
        </div>
      </div>
    </div>
  );
}
