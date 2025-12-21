import pool from '../config/dbconfig.js';

export const logTodayInputs = async (req, res) => {
  try {
    const query = `
      SELECT 
        l.id_log_input_dashboard,
        'Delivery Fee' AS jenis,
        df.nominal AS nominal,
        DATE(df.tanggal) AS tanggal,       
        '-' AS jenis_pembayaran,
        '-' AS jenis_pengeluaran,
        '-' AS nama_karyawan,
        '-' AS deskripsi
      FROM log_input_dashboard l
      JOIN input_deliveryfee df ON l.id_input_deliveryfee = df.id_input_deliveryfee
      WHERE DATE(df.tanggal) = DATE(CONVERT_TZ(NOW(), '+00:00', '+08:00')) 
      AND df.status = 'active'

      UNION ALL

      SELECT
        l.id_log_input_dashboard,
        'DFOD' AS jenis,
        d.nominal AS nominal,
        DATE(d.tanggal_dfod) AS tanggal,   
        d.jenis_pembayaran AS jenis_pembayaran,
        '-' AS jenis_pengeluaran,
        '-' AS nama_karyawan,
        '-' AS deskripsi
      FROM log_input_dashboard l
      JOIN input_dfod d ON l.id_input_dfod = d.id_input_dfod
      WHERE DATE(d.tanggal_dfod) = DATE(CONVERT_TZ(NOW(), '+00:00', '+08:00')) 
      AND d.status = 'active'

      UNION ALL

      SELECT
        l.id_log_input_dashboard,
        'Outgoing' AS jenis,
        o.nominal_bersih AS nominal,
        DATE(o.tanggal_outgoing) AS tanggal,   
        o.jenis_pembayaran AS jenis_pembayaran,
        '-' AS jenis_pengeluaran,
        '-' AS nama_karyawan,
        '-' AS deskripsi
      FROM log_input_dashboard l
      JOIN input_outgoing o ON l.id_input_outgoing = o.id_input_outgoing
      WHERE DATE(o.tanggal_outgoing) = DATE(CONVERT_TZ(NOW(), '+00:00', '+08:00')) 
      AND o.status = 'active'

      UNION ALL

      SELECT
        l.id_log_input_dashboard,
        'Pengeluaran' AS jenis,
        p.nominal_pengeluaran AS nominal,
        DATE(p.tanggal_pengeluaran) AS tanggal,
        p.jenis_pembayaran AS jenis_pembayaran,
        p.jenis_pengeluaran AS jenis_pengeluaran,
        k.nama_karyawan AS nama_karyawan,
        p.deskripsi AS deskripsi
      FROM log_input_dashboard l
      JOIN input_pengeluaran p ON l.id_input_pengeluaran = p.id_input_pengeluaran
      LEFT JOIN karyawan k ON p.id_karyawan = k.id_karyawan
      WHERE DATE(p.tanggal_pengeluaran) = DATE(CONVERT_TZ(NOW(), '+00:00', '+08:00')) 
      AND p.status = 'active'

      ORDER BY tanggal DESC
    `;

    const [rows] = await pool.query(query);
    res.json(rows);

  } catch (err) {
    console.error("ERROR FETCH TODAY INPUTS", err);
    res.status(500).json({ error: err.message });
  }
};