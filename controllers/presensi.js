import pool from "../config/dbconfig.js";

// --- FUNGSI TANGGAL LOKAL INDONESIA ---
function getLocalDate() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Makassar", // WITA
  });
}

function getLocalTime() {
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: "Asia/Makassar", // WITA
  });
}

export const getAllPresensi = async (req, res) => {
  const role = req.user?.role;
  
  if (role !== "Super Admin" && role !== "Admin") {
    return res.status(403).json({ error: "Akses ditolak: Hanya Admin dan Super Admin yang diizinkan" });
  }

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
  const role = req.user?.role;
  if (role !== "Super Admin" && role !== "Admin") {
    return res.status(403).json({ error: "Akses ditolak: Hanya Admin dan Super Admin yang diizinkan" });
  }

  const { id_karyawan, kehadiran } = req.body;
  if (!id_karyawan || !kehadiran)
    return res.status(400).json({ message: "id_karyawan dan kehadiran wajib diisi" });

  const tanggal_presensi = getLocalDate();
  const waktu_presensi = getLocalTime();

  try {
    // Cek apakah sudah ada presensi hari ini
    const [existing] = await pool.query(
      "SELECT * FROM presensi WHERE id_karyawan = ? AND tanggal_presensi = ?",
      [id_karyawan, tanggal_presensi]
    );

    // Jika sudah ada → update
    if (existing.length > 0) {
      await pool.query(
        "UPDATE presensi SET kehadiran = ?, waktu_presensi = ? WHERE id_presensi = ?",
        [kehadiran, getLocalTime(), existing[0].id_presensi]
      );

      return res.status(200).json({
        message: "Presensi diperbarui",
        id_presensi: existing[0].id_presensi,
      });
    }

    // Insert baru
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
  if (req.user?.role !== "Super Admin") {
  return res.status(403).json({ error: "Akses ditolak: Hanya Super Admin yang diizinkan mengedit presensi" });
}

  const { id_presensi, kehadiran } = req.body;

  if (!id_presensi || !kehadiran) {
    return res.status(400).json({ message: "id_presensi dan kehadiran wajib diisi" });
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
