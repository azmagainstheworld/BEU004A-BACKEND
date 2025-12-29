import pool from '../config/dbconfig.js';

export const logTodayInputs = async (req, res) => {
  const userRoles = req.user?.roles || [];
  const isAuthorized = userRoles.some(r => {
    const roleClean = r.replace(/\s+/g, '').toLowerCase();
    return roleClean === "superadmin" || roleClean === "admin";
  });

  if (!isAuthorized) {
    return res.status(403).json({ error: "Akses ditolak: Hanya Admin dan Super Admin yang diizinkan" });
  }
  
  try {
    // Mengambil tanggal hari ini di WITA sebagai patokan filter
    const todayStr = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Makassar",
    });

    const query = `
      SELECT 
        l.id_log_input_dashboard,
        'Delivery Fee' AS jenis,
        df.nominal AS nominal,
        DATE_FORMAT(df.tanggal, '%Y-%m-%d') AS tanggal_bersih, 
        '-' AS jenis_pembayaran,
        '-' AS jenis_pengeluaran,
        '-' AS nama_karyawan,
        '-' AS deskripsi
      FROM log_input_dashboard l
      JOIN input_deliveryfee df ON l.id_input_deliveryfee = df.id_input_deliveryfee
      WHERE DATE(df.tanggal) = ? AND df.status = 'active'

      UNION ALL

      SELECT
        l.id_log_input_dashboard,
        'DFOD' AS jenis,
        d.nominal AS nominal,
        DATE_FORMAT(d.tanggal_dfod, '%Y-%m-%d') AS tanggal_bersih, 
        d.jenis_pembayaran AS jenis_pembayaran,
        '-' AS jenis_pengeluaran,
        '-' AS nama_karyawan,
        '-' AS deskripsi
      FROM log_input_dashboard l
      JOIN input_dfod d ON l.id_input_dfod = d.id_input_dfod
      WHERE DATE(d.tanggal_dfod) = ? AND d.status = 'active'

      UNION ALL

      SELECT
        l.id_log_input_dashboard,
        'Outgoing' AS jenis,
        o.nominal_bersih AS nominal,
        DATE_FORMAT(o.tanggal_outgoing, '%Y-%m-%d') AS tanggal_bersih, 
        o.jenis_pembayaran AS jenis_pembayaran,
        '-' AS jenis_pengeluaran,
        '-' AS nama_karyawan,
        '-' AS deskripsi
      FROM log_input_dashboard l
      JOIN input_outgoing o ON l.id_input_outgoing = o.id_input_outgoing
      WHERE DATE(o.tanggal_outgoing) = ? AND o.status = 'active'

      UNION ALL

      SELECT
        l.id_log_input_dashboard,
        'Pengeluaran' AS jenis,
        p.nominal_pengeluaran AS nominal,
        DATE_FORMAT(p.tanggal_pengeluaran, '%Y-%m-%d') AS tanggal_bersih, 
        p.jenis_pembayaran AS jenis_pembayaran,
        p.jenis_pengeluaran AS jenis_pengeluaran,
        k.nama_karyawan AS nama_karyawan,
        p.deskripsi AS deskripsi
      FROM log_input_dashboard l
      JOIN input_pengeluaran p ON l.id_input_pengeluaran = p.id_input_pengeluaran
      LEFT JOIN karyawan k ON p.id_karyawan = k.id_karyawan
      WHERE DATE(p.tanggal_pengeluaran) = ? AND p.status = 'active'

      ORDER BY tanggal_bersih DESC
    `;

    const [rows] = await pool.query(query, [todayStr, todayStr, todayStr, todayStr]);
    res.json(rows);

  } catch (err) {
    console.error("ERROR FETCH TODAY INPUTS", err);
    res.status(500).json({ error: err.message });
  }
};
