import axios from "../api/axios";

export const testOracleConnection = async (data) => {
  const res = await axios.post("/oracle/test", data);
  return res.data;
};

export const pushAllSessions = async (data) => {
  const res = await axios.post("/oracle/github/push-all", data);
  return res.data;
};

export const pushLatestSessions = async (data) => {
  const res = await axios.post("/oracle/github/push-latest", data);
  return res.data;
};

export const pushSession = async (sessionNo, data) => {
  const res = await axios.post(`/oracle/github/push/${sessionNo}`, data);
  return res.data;
};

export const checkOracleConnection = async (data) => {
  const res = await axios.post("/oracle/check", data);
  return res.data;
}