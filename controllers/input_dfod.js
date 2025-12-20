import pool from "../config/dbconfig.js";

const parseNominal = (nominal) => {
  const clean = String(nominal).replace(/\./g, "");
  const number = Number(clean);
  if (isNaN(number) || number < 1000) {
    throw new Error("Nominal minimal Rp 1.000");
  }
  return number;
};

export const formatTanggal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const mapJenisTransaksi = (jenis_pembayaran) => {
  const lower = jenis_pembayaran.toLowerCase();
  if (lower === "cash") return "Kas";
  if (lower === "transfer") return "Transfer";
  return null;
};

export const getAllDFOD = async (req, res) => {
  try {
    const userRoles = req.user?.roles || [];
    let query;

    if (userRoles.some(r => r.replace(/\s+/g, '').toLowerCase() === "superadmin")) {
      query = "SELECT * FROM input_dfod WHERE status = 'active' ORDER BY tanggal_dfod DESC";
    } else if (userRoles.some(r => r.replace(/\s+/g, '').toLowerCase() === "admin")) {
      query = "SELECT * FROM input_dfod WHERE status = 'active' AND DATE(tanggal_dfod) = CURDATE() ORDER BY tanggal_dfod DESC";
    } else {
      return res.status(403).json({ error: "Access denied" });
    }

    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching DFOD:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ------------------------- INSERT (FINAL) -------------------------
export const insertDFOD = async (req, res) => {
  const { nominal, jenis_pembayaran } = req.body;
  
  // PERBAIKAN V1: Menangani validasi 400 SEBELUM memulai transaksi
  if (!jenis_pembayaran) {
    // Jika validasi gagal, kembalikan 400 (tidak perlu rollback karena transaksi belum dimulai)
    return res.status(400).json({ error: "Jenis pembayaran wajib diisi" });
  }
  
  let conn; // Deklarasi conn di luar try
  try {
    // Memulai transaksi
    conn = await pool.getConnection(); 
    await conn.beginTransaction();

    const nominalParsed = parseNominal(nominal);
    const tanggal = formatTanggal();

    // 1. Insert data utama
    const [result] = await conn.query(
      "INSERT INTO input_dfod (tanggal_dfod, nominal, jenis_pembayaran, status) VALUES (?, ?, ?, 'active')",
      [tanggal, nominalParsed, jenis_pembayaran]
    );

    const id_input_dfod = result.insertId;
    const jenisTransaksi = mapJenisTransaksi(jenis_pembayaran);

    // 2. Insert Laporan Keuangan (Double Entry)
    if (jenisTransaksi) {
      // Entry 1: Kas/Transfer (Pemasukan)
      await conn.query(
        "INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, ?, ?)",
        [tanggal, jenisTransaksi, nominalParsed]
      );
      // Entry 2: Saldo JFS (Pengurangan)
      await conn.query(
        "INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, 'Saldo JFS', ?)",
        [tanggal, -nominalParsed]
      );
    }

    // 3. Tambahkan log dashboard
    await conn.query("INSERT INTO log_input_dashboard (id_input_dfod) VALUES (?)", [id_input_dfod]);

    await conn.commit(); 
    res.status(201).json({ message: "DFOD created successfully", id_input_dfod });

  } catch (err) {
    if (conn) await conn.rollback(); 
    console.error("Error inserting DFOD:", err);
    // Tangani error Nominal (yang datang dari throw di parseNominal)
    if (err.message && err.message.includes("Nominal")) {
       return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    if (conn) conn.release(); 
  }
};

// ------------------------- EDIT (FINAL) -------------------------
export const editDFOD = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const { id_input_dfod, nominal, jenis_pembayaran } = req.body;

    if (!jenis_pembayaran) {
      await conn.rollback();
      return res.status(400).json({ error: "Jenis pembayaran wajib diisi" });
    }

    const nominalParsed = parseNominal(nominal);
    const tanggal = formatTanggal();

    // 1. Ambil data lama
    const [results] = await conn.query(
      "SELECT * FROM input_dfod WHERE id_input_dfod = ?",
      [id_input_dfod]
    );

    const oldData = results?.[0];
    if (!oldData) {
      await conn.rollback();
      return res.status(404).json({ error: "Data not found" });
    }

    // 2. Update input_dfod
    await conn.query(
      "UPDATE input_dfod SET nominal = ?, jenis_pembayaran = ?, tanggal_dfod = ? WHERE id_input_dfod = ?",
      [nominalParsed, jenis_pembayaran, tanggal, id_input_dfod]
    );

    // 3. Reverse laporan lama
    const oldJenis = mapJenisTransaksi(oldData.jenis_pembayaran);

    if (oldJenis) {
      await conn.query(
        "DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = ? AND nominal = ?",
        [oldData.tanggal_dfod, oldJenis, oldData.nominal]
      );

      await conn.query(
        "DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = 'Saldo JFS' AND nominal = ?",
        [oldData.tanggal_dfod, -oldData.nominal]
      );
    }

    // 4. Insert laporan baru
    const newJenis = mapJenisTransaksi(jenis_pembayaran);

    if (newJenis) {
      await conn.query(
        "INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, ?, ?)",
        [tanggal, newJenis, nominalParsed]
      );

      await conn.query(
        "INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, 'Saldo JFS', ?)",
        [tanggal, -nominalParsed]
      );
    }

    // 5. Update log dashboard
    await conn.query(
      "DELETE FROM log_input_dashboard WHERE id_input_dfod = ?",
      [id_input_dfod]
    );

    await conn.query(
      "INSERT INTO log_input_dashboard (id_input_dfod) VALUES (?)",
      [id_input_dfod]
    );

    await conn.commit();
    res.json({ message: "DFOD updated successfully" });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error updating DFOD:", err);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    if (conn) conn.release();
  }
};


// ------------------------- SOFT DELETE (FINAL) -------------------------

export const deleteDFOD = async (req, res) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const { id_input_dfod } = req.body;
    
    // Ambil data lengkap termasuk jenis_pembayaran untuk menentukan apa yang harus di-reverse
    const [results] = await conn.query(
      "SELECT tanggal_dfod, nominal, jenis_pembayaran FROM input_dfod WHERE id_input_dfod = ? AND status = 'active'", 
      [id_input_dfod]
    );
    const data = results && results.length > 0 ? results[0] : null;
    
    if (!data) {
      await conn.rollback();
      return res.status(404).json({ error: "Data not found or already deleted" });
    }
    
    // 1. Soft delete record DFOD
    await conn.query(
      "UPDATE input_dfod SET status = 'deleted' WHERE id_input_dfod = ?", 
      [id_input_dfod]
    );
      
    // 2. REVERSE Saldo JFS (Tambahkan kembali nominal yang sebelumnya dikurangi saat Add)
    await conn.query(
      "UPDATE laporan_keuangan SET nominal = nominal + ? WHERE DATE(tanggal) = DATE(?) AND jenis_transaksi = 'Saldo JFS'",
      [data.nominal, data.tanggal_dfod] 
    );

    // 3. REVERSE Kas / Transfer (Kurangi nominal yang sebelumnya bertambah saat Add)
    const jenisTransaksi = mapJenisTransaksi(data.jenis_pembayaran);
    if (jenisTransaksi) {
      await conn.query(
        "UPDATE laporan_keuangan SET nominal = nominal - ? WHERE DATE(tanggal) = DATE(?) AND jenis_transaksi = ?",
        [data.nominal, data.tanggal_dfod, jenisTransaksi]
      );
    }
      
    // 4. Hapus entri dari log_input_dashboard
    await conn.query(
      "DELETE FROM log_input_dashboard WHERE id_input_dfod = ?",
      [id_input_dfod]
    );
    
    await conn.commit();
    res.status(200).json({ message: "Soft delete berhasil, saldo JFS dan Kas/Transfer telah di-reverse" });
  
  } catch (err) {
    if (conn) await conn.rollback(); 
    console.error("Error soft deleting DFOD:", err);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    if (conn) conn.release(); 
  }
};

// ------------------------- GET TRASH -------------------------

export const getTrashDFOD = async (req, res) => {
  try {
    const [results] = await pool.query(
      "SELECT * FROM input_dfod WHERE status = 'deleted' ORDER BY tanggal_dfod DESC"
    );
    
    res.status(200).json(results);
  
  } catch (err) {
    console.error("Error fetching trash DFOD:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ------------------------- RESTORE (FINAL) -------------------------

export const restoreDFOD = async (req, res) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const { id_input_dfod } = req.body;
    
    // 1. Ambil data lama yang statusnya 'deleted'
    const [results] = await conn.query(
      "SELECT tanggal_dfod, nominal, jenis_pembayaran FROM input_dfod WHERE id_input_dfod = ? AND status = 'deleted'", 
      [id_input_dfod]
    );
    const data = results && results.length > 0 ? results[0] : null;
      
    if (!data) {
      await conn.rollback();
      return res.status(404).json({ error: "Data tidak ditemukan atau sudah aktif" });
    }
      
    // 2. Restore record DFOD menjadi 'active'
    await conn.query(
      "UPDATE input_dfod SET status = 'active' WHERE id_input_dfod = ?", 
      [id_input_dfod]
    );
      
    // 3. Terapkan kembali dampak Saldo JFS (Kurangi nominal / -)
    await conn.query(
      "UPDATE laporan_keuangan SET nominal = nominal - ? WHERE DATE(tanggal) = DATE(?) AND jenis_transaksi = 'Saldo JFS'",
      [data.nominal, data.tanggal_dfod]
    );

    // 4. Terapkan kembali dampak Kas / Transfer (Tambah nominal / +)
    const jenisTransaksi = mapJenisTransaksi(data.jenis_pembayaran);
    if (jenisTransaksi) {
      await conn.query(
        "UPDATE laporan_keuangan SET nominal = nominal + ? WHERE DATE(tanggal) = DATE(?) AND jenis_transaksi = ?",
        [data.nominal, data.tanggal_dfod, jenisTransaksi]
      );
    }
    
    // 5. Masukkan kembali ke log dashboard
    await conn.query("INSERT INTO log_input_dashboard (id_input_dfod) VALUES (?)", [id_input_dfod]);

    await conn.commit();
    res.status(200).json({ message: "Restore berhasil, saldo JFS dipotong dan Kas/Transfer ditambahkan kembali" });

  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error restoring DFOD:", err);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    if (conn) conn.release();
  }
};

// ------------------------- DELETE PERMANENT (FINAL) -------------------------

export const deletePermanentDFOD = async (req, res) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const { id_input_dfod } = req.body;

    // 1. Ambil data sebelum penghapusan
    const [results] = await conn.query(
      "SELECT tanggal_dfod, nominal, jenis_pembayaran FROM input_dfod WHERE id_input_dfod = ?",
      [id_input_dfod]
    );
    const data = results && results.length > 0 ? results[0] : null;

    if (!data) {
      await conn.rollback();
      return res.status(404).json({ error: "Data not found" });
    }

    const jenisTransaksi = mapJenisTransaksi(data.jenis_pembayaran);

    // 2. Hapus dari input_dfod
    await conn.query("DELETE FROM input_dfod WHERE id_input_dfod = ?", [id_input_dfod]);

    // 3. Hapus entri keuangan terkait (Kas/Transfer dan Saldo JFS)
    if (jenisTransaksi) {
      // Hapus transaksi Kas/Transfer (nominal positif)
      await conn.query(
        "DELETE FROM laporan_keuangan WHERE DATE(tanggal) = DATE(?) AND jenis_transaksi = ? AND nominal = ?",
        [data.tanggal_dfod, jenisTransaksi, data.nominal]
      );
      // Hapus entri Saldo JFS (nominal negatif)
      await conn.query(
        "DELETE FROM laporan_keuangan WHERE DATE(tanggal) = DATE(?) AND jenis_transaksi = 'Saldo JFS' AND nominal = ?",
        [data.tanggal_dfod, -data.nominal]
      );
    }

    // 4. Hapus dari log_input_dashboard
    await conn.query(
      "DELETE FROM log_input_dashboard WHERE id_input_dfod = ?",
      [id_input_dfod]
    );

    await conn.commit();
    res.status(200).json({ message: "Delete permanen berhasil" });

  } catch (err) {
    if (conn) await conn.rollback();
    console.error("Error deleting DFOD permanently:", err);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    if (conn) conn.release();
  }
};