import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    
  tls: {
    rejectUnauthorized: true
  },
  connectionTimeout: 20000, 
  greetingTimeout: 20000,
  socketTimeout: 20000,
  logger: true,
  debug: true
});

transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP configuration error:', error);
    } else {
        console.log('SMTP server is ready to send emails');
    }
});

export const sendOtpEmail = async (to, otp, name) => {
    const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.SMTP_USER}>`,
        to,
        subject: '🔐 Your OTP - ODI to Databricks AI Converter',
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>OTP Verification</title>

<style>
    body {
        margin: 0;
        padding: 0;
        background-color: #0f172a;
        font-family: 'Segoe UI', Tahoma, sans-serif;
    }

    .wrapper {
        max-width: 600px;
        margin: 40px auto;
        background: #ffffff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 20px 50px rgba(0,0,0,0.4);
    }

    .header {
        background: linear-gradient(135deg, #020617, #1e293b);
        padding: 35px;
        text-align: center;
    }

    .logo {
        font-size: 26px;
        font-weight: bold;
        color: #38bdf8;
        letter-spacing: 1px;
    }

    .tagline {
        color: #94a3b8;
        font-size: 13px;
        margin-top: 6px;
    }

    .content {
        padding: 40px 30px;
        color: #1e293b;
    }

    .title {
        font-size: 24px;
        font-weight: 600;
        margin-bottom: 15px;
    }

    .message {
        font-size: 16px;
        line-height: 1.7;
        color: #475569;
        margin-bottom: 20px;
    }

    .otp-box {
        text-align: center;
        margin: 30px 0;
    }

    .otp-code {
        display: inline-block;
        font-size: 34px;
        letter-spacing: 8px;
        font-weight: bold;
        padding: 18px 30px;
        border-radius: 10px;
        background: linear-gradient(135deg, #2563eb, #38bdf8);
        color: white;
        font-family: monospace;
    }

    .security-box {
        background: #f1f5f9;
        border-left: 4px solid #38bdf8;
        padding: 15px;
        border-radius: 6px;
        margin-top: 25px;
        font-size: 14px;
        color: #334155;
    }

    .features {
        margin-top: 30px;
        font-size: 14px;
        color: #475569;
    }

    .feature {
        margin-bottom: 10px;
    }

    .footer {
        background: #020617;
        color: #94a3b8;
        text-align: center;
        padding: 25px;
        font-size: 12px;
    }

    .footer strong {
        color: #38bdf8;
    }

    @media (max-width: 600px) {
        .content {
            padding: 25px 20px;
        }
        .otp-code {
            font-size: 28px;
            letter-spacing: 6px;
        }
    }
</style>
</head>

<body>
    <div class="wrapper">

        <div class="header">
            <div class="logo">⚡ ODI → Databricks AI Converter</div>
            <div class="tagline">AI-Powered ODI Mapping & SQL Conversion Platform</div>
        </div>

        <div class="content">
            <div class="title">Your One-Time Password (OTP)</div>

            <p class="message">
                Hi <strong>${name}</strong>,
            </p>

            <p class="message">
                Use the OTP below to securely verify your account and access the 
                ODI to Databricks AI Converter dashboard.
            </p>

            <div class="otp-box">
                <div class="otp-code">${otp}</div>
            </div>

            <div class="security-box">
                🔐 Security Notice:
                <ul style="margin-top:10px; padding-left:18px;">
                    <li>This OTP is valid for 5 minutes</li>
                    <li>Do not share this code with anyone</li>
                    <li>Our team will never ask for your OTP</li>
                </ul>
            </div>

            <div class="features">
                <div class="feature">⚡ Convert ODI to Databricks code using AI</div>
                <div class="feature">🧠 Smart SQL & Notebook generation</div>
                <div class="feature">📂 Upload ODI XML / Mappings directly</div>
                <div class="feature">🔒 Secure & enterprise-grade processing</div>
            </div>

            <p style="margin-top:25px; font-size:13px; color:#94a3b8;">
                If you did not request this OTP, you can safely ignore this email.
            </p>
        </div>

        <div class="footer">
            <strong>ODI to Databricks AI Converter</strong><br/>
            Secure Authentication System<br/><br/>
            © 2026 All Rights Reserved
        </div>

    </div>
</body>
</html>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('OTP Email sent:', info.messageId);
        return { success: true };
    } catch (error) {
        console.error('Error sending OTP email:', error);
        throw new Error(`Failed to send OTP email: ${error.message}`);
    }
};