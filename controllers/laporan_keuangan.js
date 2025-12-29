import pool from "../config/dbconfig.js";

export const getLaporanKeuangan = async (req, res) => {
  const userRoles = req.user?.roles || [];
  const isAuthorized = userRoles.some(r => {
    const roleClean = r.replace(/\s+/g, '').toLowerCase();
    return roleClean === "superadmin" || roleClean === "admin";
  });

  if (!isAuthorized) {
    return res.status(403).json({ error: "Akses ditolak: Hanya Admin dan Super Admin yang diizinkan" });
  }
  
  try {
    const [rows] = await pool.query(`
      SELECT 
        DATE_FORMAT(tanggal, '%Y-%m-%d') AS tanggal_bersih,
        SUM(CASE WHEN jenis_transaksi = 'Kas' THEN nominal ELSE 0 END) AS Kas,
        SUM(CASE WHEN jenis_transaksi = 'Saldo JFS' THEN nominal ELSE 0 END) AS Saldo_JFS,
        SUM(CASE WHEN jenis_transaksi = 'Transfer' THEN nominal ELSE 0 END) AS Transfer
      FROM laporan_keuangan
      GROUP BY tanggal_bersih
      ORDER BY tanggal_bersih DESC
    `);

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
