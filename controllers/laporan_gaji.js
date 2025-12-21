
import pool from "../config/dbconfig.js";

function pad2(n) { return String(n).padStart(2, "0"); }

const getLaporanGaji = async (req, res) => {
  console.log("===== Controller getLaporanGaji terpanggil! =====");

  try {
    const { bulan } = req.query;

    const current = bulan ? new Date(bulan + "-01") : new Date();

    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");

    const start = `${year}-${month}-01`;
    const end = `${year}-${month}-${new Date(year, current.getMonth() + 1, 0).getDate()}`;

    console.log(`Periode: ${start} sampai ${end}`);

    const [ping] = await pool.query("SELECT 1");
    console.log("PING DB OK:", ping);

    const sql = `
      SELECT 
        k.id_karyawan,
        k.nama_karyawan,
        mg.upah_perhari,
        mg.bonus,

        (
          SELECT COUNT(*)
          FROM presensi p
          WHERE p.id_karyawan = k.id_karyawan
            AND DATE(p.tanggal_presensi) BETWEEN ? AND ?
            AND (p.kehadiran = 'Hadir' OR p.kehadiran = 'hadir' OR p.kehadiran = 'H')
        ) AS total_presensi,

        (
          SELECT IFNULL(SUM(ip.nominal_pengeluaran),0)
          FROM input_pengeluaran ip
          WHERE ip.id_karyawan = k.id_karyawan
            AND DATE(ip.tanggal_pengeluaran) BETWEEN ? AND ?
        ) AS kasbon,

        (
          (
            SELECT COUNT(*)
            FROM presensi p2
            WHERE p2.id_karyawan = k.id_karyawan
              AND DATE(p2.tanggal_presensi) BETWEEN ? AND ?
              AND (p2.kehadiran = 'Hadir' OR p2.kehadiran = 'hadir' OR p2.kehadiran = 'H')
          ) * COALESCE(mg.upah_perhari,0)
        ) + COALESCE(mg.bonus,0) AS gaji_kotor,

        (
          (
            (
              SELECT COUNT(*)
              FROM presensi p3
              WHERE p3.id_karyawan = k.id_karyawan
                AND DATE(p3.tanggal_presensi) BETWEEN ? AND ?
                AND (p3.kehadiran = 'Hadir' OR p3.kehadiran = 'hadir' OR p3.kehadiran = 'H')
            ) * COALESCE(mg.upah_perhari,0)
          ) + COALESCE(mg.bonus,0)
        ) -
        (
          SELECT IFNULL(SUM(ip2.nominal_pengeluaran),0)
          FROM input_pengeluaran ip2
          WHERE ip2.id_karyawan = k.id_karyawan
            AND DATE(ip2.tanggal_pengeluaran) BETWEEN ? AND ?
        ) AS gaji_bersih

      FROM karyawan k
      LEFT JOIN manajemen_gaji mg ON mg.id_karyawan = k.id_karyawan
      WHERE k.status = 'active'
      ORDER BY k.nama_karyawan ASC;
    `;

    const params = [start, end, start, end, start, end, start, end, start, end];

    console.log("Menjalankan query (params):", params);

    const [rows] = await pool.query(sql, params);

    return res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.log("ERROR:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
export { getLaporanGaji };