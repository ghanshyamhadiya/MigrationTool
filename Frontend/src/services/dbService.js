import axios from "../api/axios";

export const getConversionLogs = async () => {
  const res = await axios.get("/db/logs");
  return res.data;
};