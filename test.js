import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log(
  "EMAIL_APP_PASSWORD:",
  process.env.EMAIL_APP_PASSWORD ? "Loaded" : "Missing"
);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

async function sendEmail(
  to = "manvendrasingh829031@gmail.com",
  subject = "Test Email",
  html = "<h1>Email Working ✅</h1>"
) {
  try {
    const info = await transporter.sendMail({
      from: `FreelancerRadar <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("Email sent:", info.messageId);
  } catch (error) {
    console.error("Email error:", error);
  }
}

await sendEmail();