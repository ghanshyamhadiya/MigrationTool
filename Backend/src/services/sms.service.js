import axios from "axios";

const FAST2SMS_API_KEY = process.env.SMS_API_KEY;

export const sendOTP = async (mobile, otp) => {
  try {
    const response = await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      {
        route: "q",
        message: `Your OTP is ${otp}. It is valid for 5 minutes.`,
        numbers: mobile,
      },
      {
        headers: {
          authorization: FAST2SMS_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Fast2SMS Error:", error.response?.data || error.message);
    throw new Error("Failed to send OTP SMS");
  }
};