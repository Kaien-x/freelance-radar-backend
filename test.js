import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

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

    // email sent successfully (removed debug logging)
  } catch (error) {
    console.error("Email error:", error);
  }
}

await sendEmail();