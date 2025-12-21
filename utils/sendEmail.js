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
// import nodemailer from "nodemailer";

// export const sendEmail = async (to, subject, htmlContent) => {
//   const transporter = nodemailer.createTransport({
//     host: "smtp.gmail.com",
//     port: 587,
//     secure: false, // Wajib false untuk port 587
//     auth: {
//       user: process.env.EMAIL_USER,
//       pass: process.env.EMAIL_PASS
//     },
//     tls: {
//       // Tambahkan ini untuk memaksa koneksi tetap terbuka di server cloud
//       rejectUnauthorized: false, 
//       minVersion: "TLSv1.2"
//     }
//   });

//   try {
//     await transporter.sendMail({
//       from: `"Admin J&T Cargo" <${process.env.EMAIL_USER}>`,
//       to,
//       subject,
//       html: htmlContent, // Pastikan mengirim htmlContent
//     });
//     console.log("Email terkirim ke:", to);
//   } catch (error) {
//     console.error("Gagal mengirim email:", error);
//     throw error; // Dilempar agar ditangkap catch di auth.js
//   }
// };

// import nodemailer from "nodemailer";

// export const sendEmail = async (to, subject, htmlContent) => {
//   const transporter = nodemailer.createTransport({
//     host: "smtp.gmail.com",
//     port: 465, // Coba ganti ke 465
//     secure: true, // Wajib true untuk port 465
//     auth: {
//       user: process.env.EMAIL_USER,
//       pass: process.env.EMAIL_PASS
//     },
//     tls: {
//       rejectUnauthorized: false 
//     }
//   });

//   try {
//     // Tambahkan timeout internal agar tidak loading selamanya
//     await transporter.sendMail({
//       from: `"Admin J&T Cargo" <${process.env.EMAIL_USER}>`,
//       to,
//       subject,
//       html: htmlContent,
//     });
//   } catch (error) {
//     console.error("Gagal mengirim email:", error);
//     throw error; 
//   }
// };

// utils/sendEmail.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async (to, subject, htmlContent) => {
  try {
    const { data, error } = await resend.emails.send({
      // Label tetap 'Admin J&T Cargo', tapi alamat pengirim WAJIB onboarding@resend.dev
      from: 'Admin J&T Cargo <onboarding@resend.dev>', 
      to: [to], 
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      console.error("Resend Error Detail:", error);
      throw new Error(error.message);
    }

    console.log("Email berhasil dikirim via Resend API ID:", data.id);
    return data;
  } catch (error) {
    console.error("Gagal mengirim email via Resend:", error);
    throw error; 
  }
};