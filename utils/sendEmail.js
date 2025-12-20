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

import nodemailer from "nodemailer";

export const sendEmail = async (to, subject, htmlContent) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // Gunakan false untuk port 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false // Membantu koneksi dari server cloud
    }
  });

  try {
    await transporter.sendMail({
      from: `"Admin J&T Cargo" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
    });
    console.log("Email terkirim ke:", to);
  } catch (error) {
    console.error("Gagal mengirim email:", error);
    throw error; // Lempar error agar ditangkap oleh controller
  }
};
