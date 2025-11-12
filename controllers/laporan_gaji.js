// const db = require('../config/dbconfig');

// // GET all laporan gaji (with joined data)
// exports.getAllLaporanGaji = (req, res) => {
//   const query = `
//     SELECT lg.*, k.nama_karyawan, p.tanggal_presensi, mg.total_gaji, ip.nominal_pengeluaran
//     FROM laporan_gaji lg
//     JOIN karyawan k ON lg.id_karyawan = k.id_karyawan
//     JOIN presensi p ON lg.id_presensi = p.id_presensi
//     JOIN manajemen_gaji mg ON lg.id_manajemen_gaji = mg.id_manajemen_gaji
//     JOIN input_pengeluaran ip ON lg.id_input_pengeluaran = ip.id_input_pengeluaran
//   `;
  
//   db.query(query, (err, results) => {
//     if (err) {
//       console.error("Error fetching laporan gaji data:", err);
//       return res.status(500).json({ error: "Internal Server Error" });
//     }
//     res.json(results);
//   });
// };

// // GET laporan gaji by ID
// exports.getLaporanGajiById = (req, res) => {
//   const { id } = req.params;
//   db.query("SELECT * FROM laporan_gaji WHERE id_laporan_gaji = ?", [id], (err, results) => {
//     if (err) return res.status(500).json({ error: "Internal Server Error" });
//     if (results.length === 0) return res.status(404).json({ error: "Data not found" });
//     res.json(results[0]);
//   });
// };

// // CREATE new laporan gaji
// exports.createLaporanGaji = (req, res) => {
//   const { id_karyawan, id_presensi, id_manajemen_gaji, id_input_pengeluaran } = req.body;
//   db.query(
//     "INSERT INTO laporan_gaji (id_karyawan, id_presensi, id_manajemen_gaji, id_input_pengeluaran) VALUES (?, ?, ?, ?)",
//     [id_karyawan, id_presensi, id_manajemen_gaji, id_input_pengeluaran],
//     (err, results) => {
//       if (err) return res.status(500).json({ error: "Internal Server Error" });
//       res.status(201).json({ message: "Laporan gaji created", id: results.insertId });
//     }
//   );
// };

// // UPDATE laporan gaji
// exports.updateLaporanGaji = (req, res) => {
//   const { id } = req.params;
//   const { id_karyawan, id_presensi, id_manajemen_gaji, id_input_pengeluaran } = req.body;

//   db.query(
//     "UPDATE laporan_gaji SET id_karyawan = ?, id_presensi = ?, id_manajemen_gaji = ?, id_input_pengeluaran = ? WHERE id_laporan_gaji = ?",
//     [id_karyawan, id_presensi, id_manajemen_gaji, id_input_pengeluaran, id],
//     (err, results) => {
//       if (err) return res.status(500).json({ error: "Internal Server Error" });
//       if (results.affectedRows === 0) return res.status(404).json({ error: "Data not found" });
//       res.json({ message: "Laporan gaji updated" });
//     }
//   );
// };

// // DELETE laporan gaji
// exports.deleteLaporanGaji = (req, res) => {
//   const { id } = req.params;
//   db.query(
//     "DELETE FROM laporan_gaji WHERE id_laporan_gaji = ?",
//     [id],
//     (err, results) => {
//       if (err) return res.status(500).json({ error: "Internal Server Error" });
//       if (results.affectedRows === 0) return res.status(404).json({ error: "Data not found" });
//       res.json({ message: "Laporan gaji deleted" });
//     }
//   );
// };
