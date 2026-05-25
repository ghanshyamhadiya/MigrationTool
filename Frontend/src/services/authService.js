import axios from "../api/axios";

export const signup = async (data) => {
  const res = await axios.post("/auth/signup", data);
  return res.data;
};

export const login = async (data) => {
  const res = await axios.post("/auth/login", data);
  return res.data;
};

export const verifyOTP = async (data) => {
  const res = await axios.post("/auth/verify-otp", data);
  return res.data;
};

export const resendOTP = async (data) => {
  const res = await axios.post("/auth/resend-otp", data);
  return res.data;
};

export const saveGitToken = async (token) => {
  const res = await axios.post("/auth/token", { token });
  return res.data;
};

export const getGitToken = async () => {
  const res = await axios.get("/auth/show");
  return res.data;
};