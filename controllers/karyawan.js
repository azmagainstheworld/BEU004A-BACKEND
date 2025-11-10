import pool from "../config/dbconfig.js"; 

export const getAllKaryawan = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM karyawan");
    res.json(rows);
  } catch (err) {
    console.error("Error fetching karyawan data:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getKaryawanById = async (req, res) => {
  try {
    const { id_karyawan } = req.body;
    const [rows] = await pool.query("SELECT * FROM karyawan WHERE id_karyawan = ?", [id_karyawan]);

    if (rows.length === 0)
      return res.status(404).json({ error: "Karyawan not found" });

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching karyawan by ID:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createKaryawan = async (req, res) => {
  try {
    const { nama_karyawan, jenis_kelamin, alamat } = req.body;
    const [result] = await pool.query(
      "INSERT INTO karyawan (nama_karyawan, jenis_kelamin, alamat) VALUES (?, ?, ?)",
      [nama_karyawan, jenis_kelamin, alamat]
    );

    res.status(201).json({
      message: "Karyawan created",
      id: result.insertId,
    });
  } catch (err) {
    console.error("Error creating karyawan:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const editKaryawan = async (req, res) => {
  try {
    const { id_karyawan, nama_karyawan, jenis_kelamin, alamat } = req.body;

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

    if (alamat) {
      fields.push("alamat = ?");
      values.push(alamat);
    }

    if (fields.length === 0) {
      return res
        .status(400)
        .json({ error: "Tidak ada data yang diperbarui" });
    }

    const sql = `UPDATE karyawan SET ${fields.join(", ")} WHERE id_karyawan = ?`;
    values.push(id_karyawan);

    const [result] = await pool.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Karyawan not found" });
    }

    res.json({ message: "Karyawan updated" });
  } catch (err) {
    console.error("Error updating karyawan:", err.message);
    res.status(500).json({ error: err.message });
  }
};



export const deleteKaryawan = async (req, res) => {
  try {
    const { id_karyawan } = req.body;
    const [result] = await pool.query(
      "DELETE FROM karyawan WHERE id_karyawan = ?",
      [id_karyawan]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Karyawan not found" });

    res.json({ message: "Karyawan deleted" });
  } catch (err) {
    console.error("Error deleting karyawan:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
