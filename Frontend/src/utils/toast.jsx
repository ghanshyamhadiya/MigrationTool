import { toast } from "react-toastify";
import {
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiInfo,
} from "react-icons/fi";

const primary = "#2e6296";

const getThemeColors = () => {
  const isDark = document.documentElement.classList.contains("dark");

  return {
    success: `linear-gradient(135deg, ${primary}, #1f4e79)`,
    error: "linear-gradient(135deg, #e74c3c, #c0392b)",
    warning: "linear-gradient(135deg, #f39c12, #d68910)",
    info: "linear-gradient(135deg, #3498db, #21618c)",
    text: "#ffffff",
    shadow: isDark
      ? "0 12px 30px rgba(0,0,0,0.6)"
      : "0 12px 30px rgba(0,0,0,0.25)",
  };
};

const ToastBox = ({ icon, title, message, type }) => {
  const colors = getThemeColors();

  return (
    <div
      style={{
        display: "flex",
        gap: "12px",
        background: colors[type],
        color: colors.text,
        padding: "16px",
        borderRadius: "18px",
        minWidth: "330px",
        backdropFilter: "blur(15px)",
        boxShadow: colors.shadow,
        transition: "all 0.2s ease",
      }}
    >
      <div style={{ fontSize: "22px" }}>{icon}</div>
      <div>
        <div style={{ fontWeight: "600", fontSize: "15px" }}>{title}</div>
        <div style={{ fontSize: "13px", opacity: 0.9 }}>{message}</div>
      </div>
    </div>
  );
};

const options = {
  autoClose: 4000,
  hideProgressBar: true,
  closeButton: false,
};

// SUCCESS
export const showSuccess = (message) =>
  toast(
    <ToastBox
      icon={<FiCheckCircle />}
      title="Success"
      message={message}
      type="success"
    />,
    options,
  );

// ERROR
export const showError = (message) =>
  toast(
    <ToastBox
      icon={<FiXCircle />}
      title="Error"
      message={message}
      type="error"
    />,
    options,
  );

// WARNING
export const showWarning = (message) =>
  toast(
    <ToastBox
      icon={<FiAlertTriangle />}
      title="Warning"
      message={message}
      type="warning"
    />,
    options,
  );

// INFO
export const showInfo = (message) =>
  toast(
    <ToastBox
      icon={<FiInfo />}
      title="Information"
      message={message}
      type="info"
    />,
    options,
  );