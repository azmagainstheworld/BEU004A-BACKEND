import crypto from "crypto";
import bcrypt from "bcrypt";
import pool from "../config/dbconfig.js";
import { sendEmail } from "../utils/sendEmail.js";

/* REQUEST RESET PASSWORD*/
/* REQUEST RESET PASSWORD */
export const requestResetPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM user_jntcargobeu004a WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Email tidak terdaftar" });
    }

    const user = rows[0];    
    const userId = user.id_user_jntcargobeu004a;

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 menit

    await pool.query(
      `INSERT INTO reset_password_tokens (id_user_jntcargobeu004a, token, expires_at) 
       VALUES (?, ?, ?)`,
      [userId, token, expiresAt]
    );

    const link = `https://beu-004-a.vercel.app/reset-password?token=${token}`;

    const htmlContent = `
      <h1>Reset Password</h1>
      <p>Klik link di bawah ini untuk mereset password Anda:</p>
      <a href="${link}">${link}</a>
      <p>Link ini akan kadaluarsa dalam 15 menit.</p>
    `;

    // --- PEMANGGILAN RESEND ---
    // Pastikan await tetap ada agar error dari Resend bisa ditangkap oleh catch (error) di bawah
    await sendEmail(email, "Reset Password J&T Cargo", htmlContent);

    return res.json({ 
      message: "Link reset password telah dikirim ke email Anda",
      // Tips: Selama testing, kamu bisa sertakan link di response jika email tidak masuk
      debugLink: link 
    });

  } catch (error) {
    console.error("Error Detail:", error);
    // Jika Resend error (misal: kirim ke email selain email sendiri di mode sandbox)
    // catch ini akan menangkapnya dan mengirim status 500 ke Postman
    return res.status(500).json({ 
      message: "Gagal mengirim email verifikasi", 
      error: error.message 
    });
  }
};

// export const requestResetPassword = async (req, res) => {
//   const { email } = req.body;

//   try {
//     const [rows] = await pool.query(
//       "SELECT * FROM user_jntcargobeu004a WHERE email = ?",
//       [email]
//     );

//     if (rows.length === 0) {
//       return res.status(404).json({ message: "Email tidak terdaftar" });
//     }

//     const user = rows[0];    
//     const userId = user.id_user_jntcargobeu004a;

//     const token = crypto.randomBytes(32).toString("hex");
//     const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 menit

//     await pool.query(
//       `INSERT INTO reset_password_tokens (id_user_jntcargobeu004a, token, expires_at) 
//        VALUES (?, ?, ?)`,
//       [userId, token, expiresAt]
//     );

//     // --- KODE BARU DISINI ---
//     const link = `https://beu-004-a.vercel.app/reset-password?token=${token}`;
    
//     // Pastikan menggunakan format HTML agar link bisa diklik di email
//     const htmlContent = `
//       <p>Anda menerima email ini karena Anda (atau orang lain) telah meminta reset password untuk akun Anda.</p>
//       <p>Silakan klik link di bawah ini untuk mengatur ulang password Anda:</p>
//       <a href="${link}" style="background-color: #006400; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password Sekarang</a>
//       <p>Link ini akan kedaluwarsa dalam 15 menit.</p>
//     `;

//     // Panggil fungsi sendEmail (pastikan utils/sendEmail.js sudah diupdate ke port 587)
//     await sendEmail(email, "Reset Password J&T Cargo", htmlContent);

//     // Respon sukses ke Frontend
//     return res.json({ message: "Link reset password telah dikirim ke email Anda" });

//   } catch (error) {
//     console.error("Error di requestResetPassword:", error);
//     return res.status(500).json({ message: "Gagal mengirim email. Silakan coba lagi nanti." });
//   }
// };
// export const requestResetPassword = async (req, res) => {
//   const { email } = req.body;

//   try {
//     // Cek apakah email ada di tabel
//     const [rows] = await pool.query(
//       "SELECT * FROM user_jntcargobeu004a WHERE email = ?",
//       [email]
//     );

//     if (rows.length === 0) {
//       return res.status(404).json({ message: "Email tidak terdaftar" });
//     }

//     const user = rows[0];    
//     const userId = user.id_user_jntcargobeu004a;

//     // Generate token
//     const token = crypto.randomBytes(32).toString("hex");
//     const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 menit

//     // Simpan token ke tabel reset_password_tokens
//     await pool.query(
//       `INSERT INTO reset_password_tokens (id_user_jntcargobeu004a, token, expires_at) 
//        VALUES (?, ?, ?)`,
//       [userId, token, expiresAt]
//     );

//     // Kirim email berisi link reset password
//     const link = `https://beu-004-a.vercel.app/reset-password?token=${token}`;

//     await sendEmail(
//       email,
//       "Reset Password Anda",
//       `
//         <h2>Permintaan Reset Password</h2>
//         <p>Klik link berikut untuk mengatur ulang password Anda:</p>
//         <a href="${link}">${link}</a>
//         <p>Link berlaku hanya 15 menit.</p>
//       `
//     );

//     return res.json({ message: "Link reset password telah dikirim ke email" });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ message: "Terjadi kesalahan server" });
//   }
// };

export const checkResetToken = async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ message: "Token tidak ditemukan" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * FROM reset_password_tokens
       WHERE token = ? AND expires_at > NOW()`,
      [token]
    );

    if (rows.length === 0) {
      return res
        .status(400)
        .json({ message: "Token tidak valid atau sudah kedaluwarsa" });
    }

    return res.json({ message: "Token valid" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

/* RESET PASSWORD SETELAH TOKEN VALID */
export const resetPassword = async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;

  if (!token) {
    return res.status(400).json({ message: "Token wajib diisi" });
  }

  if (!newPassword || !confirmPassword) {
    return res.status(400).json({ message: "Password dan konfirmasi wajib diisi" });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Password dan konfirmasi tidak cocok" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT * FROM reset_password_tokens 
       WHERE token = ? AND expires_at > NOW()`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        message: "Token tidak valid atau sudah kedaluwarsa",
      });
    }

    // Ambil user sesuai token
    const userId = rows[0].id_user_jntcargobeu004a;

    // Hash password baru
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password user
    await pool.query(
      `UPDATE user_jntcargobeu004a 
       SET password = ? 
       WHERE id_user_jntcargobeu004a = ?`,
      [hashedPassword, userId]
    );

    // Hapus token setelah digunakan
    await pool.query(
      `DELETE FROM reset_password_tokens WHERE token = ?`,
      [token]
    );

    return res.json({ message: "Password berhasil diubah" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

/* USER GANTI PASSWORD SENDIRI */
export const changeOwnPassword = async (req, res) => {
  const userId = res.locals.userId;  
  const { newPassword, confirmPassword } = req.body;

  try {
    if (!newPassword || !confirmPassword)
      return res.status(400).json({ message: "Password baru & konfirmasi wajib diisi" });

    if (newPassword !== confirmPassword)
      return res.status(400).json({ message: "Konfirmasi password tidak sama" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log("USER ID >>>", userId);

 
    await pool.query(
      `UPDATE user_jntcargobeu004a 
       SET password = ? 
       WHERE id_user_jntcargobeu004a = ?`,
      [hashedPassword, userId]
    );

    return res.json({ message: "Password berhasil diganti", hashedPassword, });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

/* SUPER ADMIN GANTI PASSWORD ORANG LAIN */
export const changeOtherPassword = async (req, res) => {
  const { targetUserId, newPassword, confirmPassword } = req.body;

  try {
    if (!targetUserId || !newPassword || !confirmPassword)
      return res.status(400).json({ message: "Semua field wajib diisi" });

    if (newPassword !== confirmPassword)
      return res.status(400).json({ message: "Konfirmasi password tidak sama" });

    const [rows] = await pool.query(
      `SELECT id_user_jntcargobeu004a 
       FROM user_jntcargobeu004a 
       WHERE id_user_jntcargobeu004a = ?`,
      [targetUserId]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "User tidak ditemukan" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      `UPDATE user_jntcargobeu004a 
       SET password = ? 
       WHERE id_user_jntcargobeu004a = ?`,
      [hashedPassword, targetUserId]
    );

    return res.json({ message: "Password user berhasil diubah oleh Super Admin" });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};
