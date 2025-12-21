import pool from "../config/dbconfig.js";

/* ================================
   GET ALL MANAJEMEN GAJI
================================ */
export const getAllManajemenGaji = async (req, res) => {
  try {
    const query = `
      SELECT 
        k.id_karyawan,
        k.nama_karyawan,
        mg.upah_perhari,
        mg.bonus
      FROM karyawan k
      LEFT JOIN manajemen_gaji mg 
        ON k.id_karyawan = mg.id_karyawan
      WHERE k.status = 'active'  
      ORDER BY k.nama_karyawan ASC
    `;

    const [results] = await pool.query(query);
    res.json(results);
  } catch (err) {
    console.error("Error fetching manajemen gaji:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


export const saveManajemenGaji = async (req, res) => {
  try {
    const { id_karyawan, upah_perhari, bonus } = req.body;

    if (!id_karyawan || !upah_perhari) {
      return res.status(400).json({ error: "id_karyawan dan upah_perhari wajib diisi" });
    }

    const bonusValue = bonus ? Number(bonus) : 0;

    const query = `
      INSERT INTO manajemen_gaji (id_karyawan, upah_perhari, bonus)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        upah_perhari = VALUES(upah_perhari),
        bonus = VALUES(bonus)
    `;

    await pool.query(query, [id_karyawan, upah_perhari, bonusValue]);

    res.json({ message: "Data manajemen gaji berhasil disimpan" });
  } catch (err) {
    console.error("Error saving manajemen gaji:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


/* ================================
   GET BY ID (BODY)
   FE MENGIRIM: id_karyawan
================================ */
export const getManajemenGajiById = async (req, res) => {
  try {
    const { id_karyawan } = req.body;

    if (!id_karyawan) {
      return res.status(400).json({ error: "id_karyawan wajib diisi" });
    }

    const query = `
      SELECT mg.*, k.nama_karyawan
      FROM manajemen_gaji mg
      JOIN karyawan k ON mg.id_karyawan = k.id_karyawan
      WHERE mg.id_karyawan = ?
    `;

    const [results] = await pool.query(query, [id_karyawan]);

    if (results.length === 0) {
      return res.status(404).json({ error: "Data tidak ditemukan" });
    }

    res.json(results[0]);
  } catch (err) {
    console.error("Error fetching by body ID:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
