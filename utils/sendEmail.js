// import nodemailer from "nodemailer";

// export const sendEmail = async (to, subject, htmlContent) => {
//   const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       user: process.env.EMAIL_USER,   // email pengirim
//       pass: process.env.EMAIL_PASS    // app password
//     },
//   });

//   await transporter.sendMail({
//     from: process.env.EMAIL_USER,
//     to,
//     subject,
//     html: htmlContent,
//   });
// };

// utils/sendEmail.js
import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, htmlContent) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // Wajib false untuk port 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      // Tambahkan ini untuk memaksa koneksi tetap terbuka di server cloud
      rejectUnauthorized: false, 
      minVersion: "TLSv1.2"
    }
  });

  try {
    await transporter.sendMail({
      from: `"Admin J&T Cargo" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: htmlContent, // Pastikan mengirim htmlContent
    });
    console.log("Email terkirim ke:", to);
  } catch (error) {
    console.error("Gagal mengirim email:", error);
    throw error; // Dilempar agar ditangkap catch di auth.js
  }
};