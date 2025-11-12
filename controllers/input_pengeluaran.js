import pool from "../config/dbconfig.js";

const parseNominal = (nominal) => {
  const clean = String(nominal).replace(/\./g, "");
  const number = Number(clean);
  if (isNaN(number) || number <= 0) throw new Error("Nominal harus berupa angka positif");
  return number;
};

const mapJenisTransaksi = (jenis_pembayaran) => {
  if (jenis_pembayaran === "Cash") return "Kas";
  if (jenis_pembayaran === "Transfer") return "Transfer";
  return null;
};

export const getAllPengeluaran = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, k.nama_lengkap AS nama_karyawan
       FROM input_pengeluaran p
       LEFT JOIN karyawan k ON p.id_karyawan = k.id_karyawan
       ORDER BY p.tanggal_pengeluaran DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching pengeluaran:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getPengeluaranById = async (req, res) => {
  try {
    const { id_pengeluaran } = req.body;
    const [rows] = await pool.query(
      `SELECT p.*, k.nama_lengkap AS nama_karyawan
       FROM input_pengeluaran p
       LEFT JOIN karyawan k ON p.id_karyawan = k.id_karyawan
       WHERE p.id_input_pengeluaran = ?`,
      [id_pengeluaran]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Data tidak ditemukan" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching pengeluaran by ID:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const insertPengeluaran = async (req, res) => {
  try {
    const { nominal_pengeluaran, jenis_pengeluaran, jenis_pembayaran, deskripsi, id_karyawan } = req.body;

    if (!jenis_pengeluaran) return res.status(400).json({ error: "Jenis pengeluaran wajib diisi" });
    if (!jenis_pembayaran) return res.status(400).json({ error: "Jenis pembayaran wajib diisi" });
    if ((jenis_pengeluaran === "Operasional" || jenis_pengeluaran === "Lainnya") && !deskripsi)
      return res.status(400).json({ error: "Deskripsi wajib diisi untuk Operasional/Lainnya" });
    if (jenis_pengeluaran === "Kasbon" && !id_karyawan)
      return res.status(400).json({ error: "Nama karyawan wajib diisi untuk Kasbon" });

    const nominalParsed = parseNominal(nominal_pengeluaran);
    const tanggal = new Date();
    const karyawanIdToInsert = jenis_pengeluaran === "Kasbon" ? id_karyawan : null;
    const deskripsiToInsert = (jenis_pengeluaran === "Operasional" || jenis_pengeluaran === "Lainnya") ? deskripsi : "-";

    const [result] = await pool.query(
      `INSERT INTO input_pengeluaran
       (tanggal_pengeluaran, jenis_pengeluaran, jenis_pembayaran, nominal_pengeluaran, deskripsi, id_karyawan)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tanggal, jenis_pengeluaran, jenis_pembayaran, nominalParsed, deskripsiToInsert, karyawanIdToInsert]
    );
    const id_pengeluaran = result.insertId;

    const jenisTransaksi = mapJenisTransaksi(jenis_pembayaran);
    if (jenis_pengeluaran === "Top Up Saldo JFS") {
      await pool.query(`INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, 'Saldo JFS', ?)`, [tanggal, nominalParsed]);
    }
    if (jenisTransaksi) {
      await pool.query(`INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, ?, ?)`, [tanggal, jenisTransaksi, -nominalParsed]);
    }

    // Tambahkan log dashboard
    await pool.query(`INSERT INTO log_input_dashboard (id_input_pengeluaran) VALUES (?)`, [id_pengeluaran]);

    res.status(201).json({ message: "Pengeluaran berhasil dibuat", id_pengeluaran });
  } catch (err) {
    console.error("Error insert pengeluaran:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// update pengeluaran
export const editPengeluaran = async (req, res) => {
  try {
    const { id_pengeluaran, nominal_pengeluaran, jenis_pengeluaran, jenis_pembayaran, deskripsi, id_karyawan } = req.body;

    if (!jenis_pengeluaran) return res.status(400).json({ error: "Jenis pengeluaran wajib diisi" });
    if (!jenis_pembayaran) return res.status(400).json({ error: "Jenis pembayaran wajib diisi" });
    if ((jenis_pengeluaran === "Operasional" || jenis_pengeluaran === "Lainnya") && !deskripsi)
      return res.status(400).json({ error: "Deskripsi wajib diisi untuk Operasional/Lainnya" });
    if (jenis_pengeluaran === "Kasbon" && !id_karyawan)
      return res.status(400).json({ error: "Nama karyawan wajib diisi untuk Kasbon" });

    const nominalParsed = parseNominal(nominal_pengeluaran);
    const tanggal = new Date();

    const [[oldData]] = await pool.query(`SELECT * FROM input_pengeluaran WHERE id_input_pengeluaran = ?`, [id_pengeluaran]);
    if (!oldData) return res.status(404).json({ error: "Data tidak ditemukan" });

    const karyawanIdToInsert = jenis_pengeluaran === "Kasbon" ? id_karyawan : null;
    const deskripsiToInsert = (jenis_pengeluaran === "Operasional" || jenis_pengeluaran === "Lainnya") ? deskripsi : "-";

    // Update input_pengeluaran
    await pool.query(
      `UPDATE input_pengeluaran SET nominal_pengeluaran = ?, jenis_pembayaran = ?, jenis_pengeluaran = ?, deskripsi = ?, id_karyawan = ? WHERE id_input_pengeluaran = ?`,
      [nominalParsed, jenis_pembayaran, jenis_pengeluaran, deskripsiToInsert, karyawanIdToInsert, id_pengeluaran]
    );

    // Hapus laporan lama
    const oldJenisTransaksi = mapJenisTransaksi(oldData.jenis_pembayaran);
    if (oldData.jenis_pengeluaran === "Top Up Saldo JFS") {
      await pool.query(`DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = 'Saldo JFS' AND nominal = ?`, [oldData.tanggal_pengeluaran, oldData.nominal_pengeluaran]);
    }
    if (oldJenisTransaksi) {
      await pool.query(`DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = ? AND nominal = ?`, [oldData.tanggal_pengeluaran, oldJenisTransaksi, -oldData.nominal_pengeluaran]);
    }

    // Insert laporan baru
    const jenisTransaksi = mapJenisTransaksi(jenis_pembayaran);
    if (jenis_pengeluaran === "Top Up Saldo JFS") {
      await pool.query(`INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, 'Saldo JFS', ?)`, [tanggal, nominalParsed]);
    }
    if (jenisTransaksi) {
      await pool.query(`INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, ?, ?)`, [tanggal, jenisTransaksi, -nominalParsed]);
    }

    // Update log dashboard
    await pool.query(`DELETE FROM log_input_dashboard WHERE id_input_pengeluaran = ?`, [id_pengeluaran]);
    await pool.query(`INSERT INTO log_input_dashboard (id_input_pengeluaran) VALUES (?)`, [id_pengeluaran]);

    res.json({ message: "Pengeluaran berhasil diupdate" });
  } catch (err) {
    console.error("Error updating pengeluaran:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 🔹 DELETE pengeluaran
export const deletePengeluaran = async (req, res) => {
  try {
    const { id_pengeluaran } = req.body;
    const [[data]] = await pool.query(`SELECT * FROM input_pengeluaran WHERE id_input_pengeluaran = ?`, [id_pengeluaran]);
    if (!data) return res.status(404).json({ error: "Data tidak ditemukan" });

    const { tanggal_pengeluaran, nominal_pengeluaran, jenis_pengeluaran, jenis_pembayaran } = data;
    const jenisTransaksi = mapJenisTransaksi(jenis_pembayaran);

    // Hapus dari input_pengeluaran
    await pool.query(`DELETE FROM input_pengeluaran WHERE id_input_pengeluaran = ?`, [id_pengeluaran]);

    // Undo laporan keuangan
    if (jenis_pengeluaran === "Top Up Saldo JFS") {
      await pool.query(`DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = 'Saldo JFS' AND nominal = ?`, [tanggal_pengeluaran, nominal_pengeluaran]);
    }
    if (jenisTransaksi) {
      await pool.query(`INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, ?, ?)`, [tanggal_pengeluaran, jenisTransaksi, nominal_pengeluaran]);
    }

    // Hapus log dashboard
    await pool.query(`DELETE FROM log_input_dashboard WHERE id_input_pengeluaran = ?`, [id_pengeluaran]);

    res.json({ message: "Pengeluaran berhasil dihapus" });
  } catch (err) {
    console.error("Error deleting pengeluaran:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
