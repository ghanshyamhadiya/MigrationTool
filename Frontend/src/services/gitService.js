import axios from "../api/axios";

export const verifyGitConnection = async (token) => {
  const res = await axios.post("/git/verify-connection", { token });
  return res.data;
};