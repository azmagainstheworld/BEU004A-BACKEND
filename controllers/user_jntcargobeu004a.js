import pool from "../config/dbconfig.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const getAllUsers = async (req, res) => {
  try {
    const [results] = await pool.query(
      "SELECT id_user_jntcargobeu004a, username, email, roles FROM user_jntcargobeu004a"
    );
    res.json(results);
  } catch (err) {
    console.error("Error getAllUsers:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createSuperAdmin = async (req, res) => {
  const { username, email, password } = req.body;
  const roles = "Super Admin";

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
      "INSERT INTO user_jntcargobeu004a (username, email, password, roles) VALUES (?, ?, ?, ?)",
      [username, email, hashedPassword, roles]
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

export const createAdmin = async (req, res) => {
  const { username, email, password } = req.body;
  const roles = "Admin";

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
      "INSERT INTO user_jntcargobeu004a (username, email, password, roles) VALUES (?, ?, ?, ?)",
      [username, email, hashedPassword, roles]
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

    if (user.roles !== "Super Admin" && user.roles !== "Admin") {
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

export const deleteUser = async (req, res) => {
  const { id_user_jntcargobeu004a } = req.body;

  try {
    const [results] = await pool.query(
      "SELECT roles FROM user_jntcargobeu004a WHERE id_user_jntcargobeu004a = ?",
      [id]
    );

    if (results.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userRole = results[0].roles;

    if (userRole === "Super Admin") {
      return res
        .status(403)
        .json({ error: "Cannot delete Super Admin account" });
    }

    const [deleteResult] = await pool.query(
      "DELETE FROM user_jntcargobeu004a WHERE id_user_jntcargobeu004a = ?",
      [id]
    );

    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Admin user deleted successfully" });
  } catch (error) {
    console.error("Error deleteUser:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
