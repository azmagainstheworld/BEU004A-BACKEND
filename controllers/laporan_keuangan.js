import pool from "../config/dbconfig.js";

// 🔹 GET Laporan Keuangan + total kumulatif hingga saat ini
export const getLaporanKeuangan = async (req, res) => {
  try {
    // 🔸 Ambil data per tanggal (biar bisa ditampilkan di tabel)
    const [rows] = await pool.query(`
      SELECT 
        DATE(tanggal) AS tanggal,
        SUM(CASE WHEN jenis_transaksi = 'Kas' THEN nominal ELSE 0 END) AS Kas,
        SUM(CASE WHEN jenis_transaksi = 'Saldo JFS' THEN nominal ELSE 0 END) AS Saldo_JFS,
        SUM(CASE WHEN jenis_transaksi = 'Transfer' THEN nominal ELSE 0 END) AS Transfer
      FROM laporan_keuangan
      GROUP BY DATE(tanggal)
      ORDER BY tanggal DESC
    `);

    // 🔸 Ambil total keseluruhan dari semua waktu
    const [[totalNow]] = await pool.query(`
      SELECT 
        SUM(CASE WHEN jenis_transaksi = 'Kas' THEN nominal ELSE 0 END) AS kas,
        SUM(CASE WHEN jenis_transaksi = 'Saldo JFS' THEN nominal ELSE 0 END) AS saldo_jfs,
        SUM(CASE WHEN jenis_transaksi = 'Transfer' THEN nominal ELSE 0 END) AS transfer
      FROM laporan_keuangan
    `);

    res.json({
      laporan: rows,
      total_sekarang: totalNow
    });
  } catch (err) {
    console.error("Error fetching laporan keuangan:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
