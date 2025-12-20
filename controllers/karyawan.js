import pool from "../config/dbconfig.js";

// --- GET ALL KARYAWAN (ACTIVE ONLY) ---
export const getAllKaryawan = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM karyawan WHERE status = 'active'");
    res.json(rows);
  } catch (err) {
    console.error("Error fetching karyawan data:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// --- GET TRASH KARYAWAN (DELETED ONLY) ---
export const getTrashKaryawan = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM karyawan WHERE status = 'deleted'");
    res.json(rows);
  } catch (err) {
    console.error("Error fetching trash karyawan:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// --- GET KARYAWAN BY ID ---
export const getKaryawanById = async (req, res) => {
  try {
    const { id_karyawan } = req.body;
    const [rows] = await pool.query(
      "SELECT * FROM karyawan WHERE id_karyawan = ?",
      [id_karyawan]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Karyawan not found" });

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching karyawan by ID:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// --- CREATE KARYAWAN ---
export const createKaryawan = async (req, res) => {
  try {
    const { nama_karyawan, jenis_kelamin, ttl, alamat } = req.body;

    const [result] = await pool.query(
      "INSERT INTO karyawan (nama_karyawan, jenis_kelamin, ttl, alamat, status) VALUES (?, ?, ?, ?, 'active')",
      [nama_karyawan, jenis_kelamin, ttl, alamat]
    );

    res.status(201).json({
      message: "Karyawan created",
      id_karyawan: result.insertId,
      nama_karyawan,
      jenis_kelamin,
      ttl,
      alamat,
      status: "active",
    });
  } catch (err) {
    console.error("Error creating karyawan:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// --- UPDATE KARYAWAN ---
export const editKaryawan = async (req, res) => {
  try {
    const { id_karyawan, nama_karyawan, jenis_kelamin, ttl, alamat } = req.body;

    if (!id_karyawan) {
      return res.status(400).json({ error: "id_karyawan wajib diisi" });
    }

    const fields = [];
    const values = [];

    if (nama_karyawan) {
      fields.push("nama_karyawan = ?");
      values.push(nama_karyawan);
    }
    if (jenis_kelamin) {
      fields.push("jenis_kelamin = ?");
      values.push(jenis_kelamin);
    }
    if (ttl) {
      fields.push("ttl = ?");
      values.push(ttl);
    }
    if (alamat) {
      fields.push("alamat = ?");
      values.push(alamat);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: "Tidak ada data yang diperbarui" });
    }

    const sql = `UPDATE karyawan SET ${fields.join(", ")} WHERE id_karyawan = ?`;
    values.push(id_karyawan);

    const [result] = await pool.query(sql, values);

    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Karyawan not found" });

    res.json({
      message: "Karyawan updated",
      id_karyawan,
      nama_karyawan,
      jenis_kelamin,
      ttl,
      alamat,
    });
  } catch (err) {
    console.error("Error updating karyawan:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// --- SOFT DELETE KARYAWAN ---
export const deleteKaryawan = async (req, res) => {
  try {
    const { id_karyawan } = req.body;

    const [result] = await pool.query(
      "UPDATE karyawan SET status = 'deleted' WHERE id_karyawan = ?",
      [id_karyawan]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Karyawan not found" });

    res.json({
      message: "Karyawan moved to trash",
      id_karyawan,
    });
  } catch (err) {
    console.error("Error soft deleting karyawan:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// --- RESTORE KARYAWAN ---
export const restoreKaryawan = async (req, res) => {
  try {
    const { id_karyawan } = req.body;

    const [result] = await pool.query(
      "UPDATE karyawan SET status = 'active' WHERE id_karyawan = ?",
      [id_karyawan]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Karyawan not found" });

    res.json({
      message: "Karyawan restored",
      id_karyawan,
    });
  } catch (err) {
    console.error("Error restoring karyawan:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// --- DELETE PERMANENT ---
export const deletePermanentKaryawan = async (req, res) => {
  try {
    const { id_karyawan } = req.body;

    const [result] = await pool.query(
      "DELETE FROM karyawan WHERE id_karyawan = ?",
      [id_karyawan]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Karyawan not found" });

    res.json({
      message: "Karyawan permanently deleted",
      id_karyawan,
    });
  } catch (err) {
    console.error("Error permanently deleting karyawan:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
