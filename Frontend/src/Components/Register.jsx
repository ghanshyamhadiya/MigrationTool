import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup, verifyOTP } from "../services/authService";
import "./Register.css";
import {
  FiUser,
  FiMail,
  FiSmartphone,
  FiKey,
  FiLock,
  FiEye,
  FiEyeOff,
} from "react-icons/fi";
import appLogo from "../assets/image.png";
import { showSuccess, showError, showWarning, showInfo } from "../utils/toast";

export default function Register() {
  const navigate = useNavigate();
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile_number, setMobileNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [passwords, setPasswords] = useState({
    password: "",
    confirmPassword: "",
  });

  const handleSendOtp = async (e) => {
    e.preventDefault();

    if (otpSent) {
      showInfo("OTP has already been sent! Please check your mobile.");
      return;
    }

    try {
      const data = await signup({
        name,
        email,                          
        mobile_number,
        password: passwords.password,
      });
      if (data) {
        setOtpSent(true);
        showSuccess("OTP sent to your mobile number!");
      } else {
        showError(data.message || "Failed to send OTP");
      }
    } catch (error) {
      console.error("Connection error:", error);
      showError("Unable to connect to the server. Please try again later.");
    }
  };

  const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9]+@[a-zA-Z]+\.[a-zA-Z]+/;
    return emailRegex.test(email);
  };

  const validatePassword = (pw) => {
    const hasUpperCase = /[A-Z]/.test(pw);
    const hasLowerCase = /[a-z]/.test(pw);
    const hasNumbers = /\d/.test(pw);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pw);
    const isLongEnough = pw.length >= 8;

    return (
      hasUpperCase && hasLowerCase && hasNumbers && hasSpecial && isLongEnough
    );
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      showWarning("Invalid email format! Please enter a valid email.");
      return;
    }

    if (passwords.password !== passwords.confirmPassword) {
      showWarning("Passwords do not match!");
      return;
    }

    if (!validatePassword(passwords.password)) {
      showWarning(
        "Password must contain 8+ characters, uppercase, lowercase, number & special character.",
      );
      return;
    }

    if (!otpSent) {
      showWarning("Please request OTP first.");
      return;
    }

    if (!otp || otp.length !== 6) {
      showWarning("Please enter a valid 6-digit OTP.");
      return;
    }

    try {
      const data = await verifyOTP({
        email,
        mobile_number,
        otp,
      });
      if (data) {
        localStorage.setItem("token", data.token);
        showSuccess("Registration successful! Please log in.");
        navigate("/login");
      } else {
        showError(data.message || "Registration failed");
      }
    } catch (error) {
      console.error("Connection error:", error);
    }
  };

  return (
    <div className="register-page-wrapper">
      <div className="register-card">
        <div className="register-header">
          <img src={appLogo} alt="Flytics Logo" className="register-logo" />
          <h2>Create an Account</h2>
          <p>Join Flytics to modernize your data pipelines.</p>
        </div>

        <form className="register-form" onSubmit={handleRegister}>
          <div className="register-input-group">
            <FiUser className="register-input-icon" />
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="register-input-group">
            <FiMail className="register-input-icon" />
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="register-input-group register-otp-group">
            <FiSmartphone className="register-input-icon" />
            <input
              type="tel"
              placeholder="Mobile Number"
              value={mobile_number}
              onChange={(e) => setMobileNumber(e.target.value)}
              required
            />
            <button
              className={`register-otp-btn ${otpSent ? "sent" : ""}`}
              onClick={handleSendOtp}
              type="button"
              value={otp}
            >
              {otpSent ? "Sent!" : "Get OTP"}
            </button>
          </div>

          {otpSent && (
            <div className="register-input-group register-animate-slide">
              <FiKey className="register-input-icon" />
              <input
                type="text"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
              />
            </div>
          )}

          <div className="register-input-group">
            <FiLock className="register-input-icon" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Create Password"
              value={passwords.password}
              onChange={(e) =>
                setPasswords({ ...passwords, password: e.target.value })
              }
              required
            />
            <div
              className="password-toggle-icon"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FiEyeOff /> : <FiEye />}
            </div>
          </div>

          <div className="register-input-group">
            <FiLock className="register-input-icon" />
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm Password"
              value={passwords.confirmPassword}
              onChange={(e) =>
                setPasswords({ ...passwords, confirmPassword: e.target.value })
              }
              required
            />
            <div
              className="password-toggle-icon"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
            </div>
          </div>

          <button type="submit" className="register-submit-btn">
            Create Account
          </button>
        </form>

        <div className="register-footer-link">
          Already have an account? <Link to="/login">Log in here</Link>
        </div>
      </div>
    </div>
  );
}
