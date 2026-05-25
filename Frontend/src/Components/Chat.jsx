import React from "react";
import "./Chat.css";
import { RiSendPlaneFill } from "react-icons/ri";

export default function Chat() {
  return (
    <div className="chat-panel">
      <div className="chat-header">Support Chat</div>
      <div className="chat-body">
        <p>
          Hello! How can I help you with your ODI to Databricks migration today?
        </p>
      </div>
      <div className="chat-input-container">
        <input
          type="text"
          className="chat-input"
          placeholder="Type a message..."
        />
        <button className="chat-send-button">
          <RiSendPlaneFill size={20} />
        </button>
      </div>
    </div>
  );
}
