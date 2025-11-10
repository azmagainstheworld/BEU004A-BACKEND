import pool from "../config/dbconfig.js";

export const getAllPresensi = async (req, res) => {
  try {
    const [results] = await pool.query(`
      SELECT 
        p.*, 
        k.nama_karyawan 
      FROM presensi p 
      JOIN karyawan k ON p.id_karyawan = k.id_karyawan
    `);

    res.status(200).json(results);
  } catch (err) {
    console.error("Error getAllPresensi:", err);
    res.status(500).json({ error: "Gagal mengambil data presensi" });
  }
};

export const insertPresensi = async (req, res) => {
  const { id_karyawan, kehadiran } = req.body;

  if (!id_karyawan || !kehadiran) {
    return res
      .status(400)
      .json({ message: "id_karyawan dan kehadiran wajib diisi" });
  }

  try {
    const tanggal = new Date();
    const tanggal_presensi = tanggal.toISOString().split("T")[0];
    const waktu_presensi = tanggal.toTimeString().split(" ")[0];

    const [result] = await pool.query(
      "INSERT INTO presensi (id_karyawan, tanggal_presensi, waktu_presensi, kehadiran) VALUES (?, ?, ?, ?)",
      [id_karyawan, tanggal_presensi, waktu_presensi, kehadiran]
    );

    res.status(201).json({
      message: "Presensi berhasil ditambahkan",
      id_presensi: result.insertId,
    });
  } catch (err) {
    console.error("Error insertPresensi:", err);
    res.status(500).json({ error: "Gagal menambahkan presensi" });
  }
};

export const editPresensi = async (req, res) => {
  const { id_presensi, kehadiran } = req.body;

  if (!id_presensi || !kehadiran) {
    return res
      .status(400)
      .json({ message: "id_presensi dan kehadiran wajib diisi" });
  }

  try {
    const [result] = await pool.query(
      "UPDATE presensi SET kehadiran = ? WHERE id_presensi = ?",
      [kehadiran, id_presensi]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Presensi tidak ditemukan" });
    }

    res.status(200).json({ message: "Presensi berhasil diupdate" });
  } catch (err) {
    console.error("Error editPresensi:", err);
    res.status(500).json({ error: "Gagal memperbarui presensi" });
  }
};
