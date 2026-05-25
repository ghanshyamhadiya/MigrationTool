import axios from "../api/axios";
import { getConversionType } from "../Components/Sqlconverter";

// conversionType: "sql-sparksql" | "plsql-sparksql" | "sql-pyspark"

export const generateGemini = async (file, getConversionType) => {
  const formData = new FormData();
  formData.append("target", file);

  const res = await axios.post(`/gemini/${getConversionType}/generate`, formData);
  return res.data;
};

export const getGeminiFiles = async (params, getConversionType) => {
  const res = await axios.get(`/gemini/${getConversionType}/files`, { params });
  return res.data;
};

// export const convertFromGithub = async (data, , getConversionType = "sql-sparksql") => {
//   const res = await axios.post(`/gemini/${getConversionType()}/convert-from-github`, data);
//   return res.data;
// };

export const convertFromGithub = async (data, getConversionType) => {
  const token = localStorage.getItem("token");

  const response = await fetch(`http://localhost:8080/gemini/${getConversionType()}/convert-from-github`, {  
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return response; // ❗ return full response, not response.json()
};

export const convertSelected = async (data, getConversionType) => {
  const res = await axios.post(`/gemini/${getConversionType()}/convert-selected`, data);
  return res.data;
};