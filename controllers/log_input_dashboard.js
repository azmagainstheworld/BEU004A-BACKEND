import  pool  from '../config/dbconfig.js';

export const getTodayRecentInputs = async (req, res) => {
  try {
    // ambil tanggal hari ini
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`; // format YYYY-MM-DD

    // query semua jenis input hari ini
    const query = `
      SELECT 
        'Delivery Fee' AS jenis,
        df.nominal AS nominal,
        df.tanggal AS tanggal,
        '-' AS jenis_pembayaran,
        '-' AS nama_karyawan,
        '-' AS deskripsi
      FROM input_deliveryfee df
      WHERE DATE(df.tanggal) = ?

      UNION ALL

      SELECT
        'DFOD' AS jenis,
        d.nominal AS nominal,
        d.tanggal_dfod AS tanggal,
        d.jenis_pembayaran AS jenis_pembayaran,
        '-' AS nama_karyawan,
        '-' AS deskripsi
      FROM input_dfod d
      WHERE DATE(d.tanggal_dfod) = ?

      UNION ALL

      SELECT
        'Outgoing' AS jenis,
        o.nominal_bersih AS nominal,
        o.tanggal_outgoing AS tanggal,
        o.jenis_pembayaran AS jenis_pembayaran,
        '-' AS nama_karyawan,
        '-' AS deskripsi
      FROM input_outgoing o
      WHERE DATE(o.tanggal_outgoing) = ?

      UNION ALL

      SELECT
        'Pengeluaran' AS jenis,
        p.nominal_pengeluaran AS nominal,
        p.tanggal_pengeluaran AS tanggal,
        p.jenis_pembayaran AS jenis_pembayaran,
        k.nama_karyawan AS nama_karyawan,
        p.deskripsi AS deskripsi
      FROM input_pengeluaran p
      LEFT JOIN karyawan k ON p.id_karyawan = k.id_karyawan
      WHERE DATE(p.tanggal_pengeluaran) = ?

      ORDER BY tanggal DESC
    `;

    const [rows] = await pool.query(query, [todayStr, todayStr, todayStr, todayStr]);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching today recent inputs:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
