import pool from "../config/dbconfig.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Konfigurasi Status
const STATUS_ACTIVE = "active";
const STATUS_DELETED = "deleted";
const ROLE_SUPER_ADMIN = "Super Admin";
const ROLE_ADMIN = "Admin";

// =================================================================
// 1. GET ALL USERS (Hanya yang Statusnya ACTIVE)
export const getAllUsers = async (req, res) => {
  try {
    const [results] = await pool.query(
      "SELECT id_user_jntcargobeu004a, username, email, roles FROM user_jntcargobeu004a WHERE status = ?",
      [STATUS_ACTIVE]
    );
    res.json(results);
  } catch (err) {
    console.error("Error getAllUsers:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// =================================================================
// 2. CREATE SUPER ADMIN
// =================================================================
export const createSuperAdmin = async (req, res) => {
  const { username, email, password } = req.body;
  const roles = ROLE_SUPER_ADMIN;

  if (!username || !email || !password) {
    return res.status(400).json({ message: "Semua field wajib diisi" });
  }

  try {
    const [existingUser] = await pool.query(
      "SELECT * FROM user_jntcargobeu004a WHERE username = ? OR email = ?",
      [username, email]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        message: "Username atau email sudah terdaftar",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [insertResult] = await pool.query(
      "INSERT INTO user_jntcargobeu004a (username, email, password, roles, status) VALUES (?, ?, ?, ?, ?)",
      [username, email, hashedPassword, roles, STATUS_ACTIVE]
    );

    res.status(201).json({
      message: "Super Admin berhasil dibuat",
      id: insertResult.insertId,
    });
  } catch (error) {
    console.error("Error createSuperAdmin:", error);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// =================================================================
// 3. CREATE ADMIN
// =================================================================
export const createAdmin = async (req, res) => {
  const { username, email, password } = req.body;
  const roles = ROLE_ADMIN;

  // --- CEK FIELD KOSONG ---
  if (!username || !email || !password) {
    return res.status(400).json({ message: "Semua field wajib diisi" });
  }

  // --- VALIDASI FORMAT EMAIL (Standar Industri / RFC5322 Simplified) ---
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(email)) {
    return res.status(400).json({
      message: "Format email tidak valid",
    });
  }

  try {
    // --- CEK USERNAME / EMAIL SUDAH ADA (termasuk yang deleted) ---
    const [existingUser] = await pool.query(
      "SELECT username, email FROM user_jntcargobeu004a WHERE username = ? OR email = ?",
      [username, email]
    );

    if (existingUser.length > 0) {
      const existing = existingUser[0];
      const errors = [];

      if (existing.username === username) {
        errors.push({ field: "username", message: "Username sudah terdaftar" });
      }

      if (existing.email === email) {
        errors.push({ field: "email", message: "Email sudah terdaftar" });
      }

      if (errors.length > 0) {
        return res.status(409).json({ errors });
      }
    }

    // --- HASH PASSWORD ---
    const hashedPassword = await bcrypt.hash(password, 10);

    // --- INSERT USER BARU ---
    const [insertResult] = await pool.query(
      "INSERT INTO user_jntcargobeu004a (username, email, password, roles, status) VALUES (?, ?, ?, ?, ?)",
      [username, email, hashedPassword, roles, STATUS_ACTIVE]
    );

    res.status(201).json({
      message: "Admin berhasil dibuat",
      id: insertResult.insertId,
    });
  } catch (error) {
    console.error("Error createAdmin:", error);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// =================================================================
// 4. LOGIN USER (Tidak Berubah, hanya memastikan status 'active')
// =================================================================
export const loginUser = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username dan password wajib diisi" });
  }

  try {
    const [results] = await pool.query(
      "SELECT * FROM user_jntcargobeu004a WHERE username = ?",
      [username]
    );

    if (results.length === 0) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const user = results[0];

    // Cek status user
    if (user.status !== STATUS_ACTIVE) {
        return res.status(403).json({ message: "Akun ini telah dinonaktifkan atau dihapus" });
    }

    if (user.roles !== ROLE_SUPER_ADMIN && user.roles !== ROLE_ADMIN) {
      return res.status(403).json({
        message:
          "Akses ditolak. Hanya Super Admin dan Admin yang bisa login di endpoint ini.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Password salah" });
    }

    const token = jwt.sign(
      {
        userId: user.id_user_jntcargobeu004a,
        role: user.roles,
        username: user.username,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "Login berhasil",
      token,
      user: {
        id: user.id_user_jntcargobeu004a,
        username: user.username,
        email: user.email,
        role: user.roles,
      },
    });
  } catch (error) {
    console.error("Error loginUser:", error);
    res.status(500).json({ message: "Kesalahan pada server" });
  }
};


// =================================================================
// 5. DELETE USER (SOFT DELETE) 🗑️
// =================================================================
export const deleteUser = async (req, res) => {
  const { id_user_jntcargobeu004a } = req.body;

  if (!id_user_jntcargobeu004a) {
    return res.status(400).json({ error: "User ID required" });
  }

  try {
    // Cek role user
    const [results] = await pool.query(
      "SELECT roles, status FROM user_jntcargobeu004a WHERE id_user_jntcargobeu004a = ?",
      [id_user_jntcargobeu004a]
    );

    if (results.length === 0 || results[0].status === STATUS_DELETED) {
      return res.status(404).json({ error: "User not found or already deleted" });
    }

    const userRole = results[0].roles;

    if (userRole === ROLE_SUPER_ADMIN) {
      return res.status(403).json({ error: "Cannot delete Super Admin account" });
    }
    
    // Melakukan Soft Delete (UPDATE status menjadi 'deleted')
    const [updateResult] = await pool.query(
      "UPDATE user_jntcargobeu004a SET status = ? WHERE id_user_jntcargobeu004a = ?",
      [STATUS_DELETED, id_user_jntcargobeu004a]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Admin berhasil dihapus (Soft Deleted)" });
  } catch (error) {
    console.error("Error deleteUser (Soft Delete):", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// =================================================================
// 6. GET TRASH ADMIN (Dapatkan Admin dengan status 'deleted')
// =================================================================
export const getTrashAdmin = async (req, res) => {
    try {
        const [results] = await pool.query(
            "SELECT id_user_jntcargobeu004a, username, email FROM user_jntcargobeu004a WHERE roles = ? AND status = ?",
            [ROLE_ADMIN, STATUS_DELETED]
        );
        res.json(results);
    } catch (err) {
        console.error("Error getTrashAdmin:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// =================================================================
// 7. RESTORE ADMIN (Kembalikan status Admin menjadi 'active')
// =================================================================
export const restoreAdmin = async (req, res) => {
    const { id_user_jntcargobeu004a } = req.body;

    if (!id_user_jntcargobeu004a) {
        return res.status(400).json({ error: "User ID required" });
    }

    try {
        // Cek apakah user ada di trash dan rolenya Admin
        const [checkResult] = await pool.query(
            "SELECT id_user_jntcargobeu004a FROM user_jntcargobeu004a WHERE id_user_jntcargobeu004a = ? AND roles = ? AND status = ?",
            [id_user_jntcargobeu004a, ROLE_ADMIN, STATUS_DELETED]
        );

        if (checkResult.length === 0) {
            return res.status(404).json({ error: "Admin tidak ditemukan di trash" });
        }

        // Melakukan Restore (UPDATE status menjadi 'active')
        const [updateResult] = await pool.query(
            "UPDATE user_jntcargobeu004a SET status = ? WHERE id_user_jntcargobeu004a = ?",
            [STATUS_ACTIVE, id_user_jntcargobeu004a]
        );

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ error: "Gagal restore Admin" });
        }

        res.json({ message: "Admin berhasil direstore (Active)" });
    } catch (error) {
        console.error("Error restoreAdmin:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// =================================================================
// 8. DELETE PERMANENT ADMIN (Hapus fisik dari database)
// =================================================================
export const deletePermanentAdmin = async (req, res) => {
    const { id_user_jntcargobeu004a } = req.body;

    if (!id_user_jntcargobeu004a) {
        return res.status(400).json({ error: "User ID required" });
    }

    try {
        // Cek apakah user ada di trash dan rolenya Admin
        const [checkResult] = await pool.query(
            "SELECT id_user_jntcargobeu004a FROM user_jntcargobeu004a WHERE id_user_jntcargobeu004a = ? AND roles = ? AND status = ?",
            [id_user_jntcargobeu004a, ROLE_ADMIN, STATUS_DELETED]
        );

        if (checkResult.length === 0) {
            return res.status(404).json({ error: "Admin tidak ditemukan di trash (sudah aktif atau bukan Admin)" });
        }
        
        // Melakukan Delete Permanen
        const [deleteResult] = await pool.query(
            "DELETE FROM user_jntcargobeu004a WHERE id_user_jntcargobeu004a = ?",
            [id_user_jntcargobeu004a]
        );

        if (deleteResult.affectedRows === 0) {
            return res.status(404).json({ error: "Gagal menghapus Admin permanen" });
        }

        res.json({ message: "Admin berhasil dihapus permanen" });
    } catch (error) {
        console.error("Error deletePermanentAdmin:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};