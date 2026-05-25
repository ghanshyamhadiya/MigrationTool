import axios from "../api/axios";
import { getConversionType } from "../Components/Sqlconverter";

// conversionType: "sql-sparksql" | "plsql-sparksql" | "sql-pyspark"

export const generateClaude = async (file, getConversionType) => {
  const formData = new FormData();
  formData.append("target", file);

  const res = await axios.post(`/claude/${getConversionType()}/generate`, formData);
  return res.data;
};

export const claudeChat = async (data) => {
  const res = await axios.post("/claude/chat", data);
  return res.data;
};

export const getClaudeFiles = async (params, getConversionType) => {
  const res = await axios.get(`/claude/${getConversionType()}/files`, { params });
  return res.data;
};

export const convertClaudeFromGithub = async (data, getConversionType) => {
  const token = localStorage.getItem("token");
  const response = await fetch(
    `http://localhost:8080/claude/${getConversionType()}/convert-from-github`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    }
  );
  return response;
};
 
export const convertClaudeSelected = async (data, getConversionType) => {
  const res = await axios.post(`/claude/${getConversionType()}/convert-selected`, data);
  return res.data;
};