import pool from "../config/dbconfig.js";

//  UTIL 
const parseNominal = (value) => {
  if (value === undefined || value === null)
    throw new Error("Nominal wajib diisi");

  if (typeof value === "number") {
    if (isNaN(value) || value < 1000)
      throw new Error("Nominal minimal 1.000");
    return value;
  }

  const clean = String(value).replace(/\./g, "").replace(/,/g, "");
  const number = Number(clean);

  if (isNaN(number) || number < 1000)
    throw new Error("Nominal minimal 1.000");

  return number;
};

const formatTanggal = () => {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Makassar",
  });
};


const normalizeJenisPembayaran = (raw) => {
  if (!raw && raw !== "") return { outgoingValue: null, laporanValue: null };

  const s = String(raw).trim().toLowerCase();

  if (s === "cash" || s === "kas") {
    return { outgoingValue: "Cash", laporanValue: "Kas" };
  }
  if (s === "transfer" || s === "tf" || s === "trans") {
    return { outgoingValue: "Transfer", laporanValue: "Transfer" };
  }

  return { outgoingValue: null, laporanValue: null };
};

//  CRUD 

export const getAllOutgoing = async (req, res) => {
  try {
    const userRoles = req.user?.roles || [];
    const todayStr = formatTanggal(); 

    let statusFilter = "WHERE status = 'active'";

    if (userRoles.some(r => r.replace(/\s+/g, '').toLowerCase() === "superadmin")) {
      // Super Admin: Melihat semua data tanpa filter tanggal
      const query = `SELECT * FROM input_outgoing ${statusFilter} ORDER BY tanggal_outgoing DESC`;
      const [results] = await pool.query(query);
      return res.json(results);

    } else if (userRoles.some(r => r.replace(/\s+/g, '').toLowerCase() === "admin")) {
      const query = `
        SELECT * FROM input_outgoing
        ${statusFilter} AND DATE(tanggal_outgoing) = ?
        ORDER BY tanggal_outgoing DESC
      `;
      const [results] = await pool.query(query, [todayStr]);
      return res.json(results);

    } else {
      return res.status(403).json({ error: "Access denied" });
    }

  } catch (err) {
    console.error("Error fetching outgoing:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const insertOutgoing = async (req, res) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const { nominal, potongan, jenis_pembayaran } = req.body;

    const { outgoingValue, laporanValue } = normalizeJenisPembayaran(jenis_pembayaran);
    if (!outgoingValue || !laporanValue) {
      return res.status(400).json({ error: "Jenis pembayaran harus 'cash' atau 'transfer'" });
    }

    const rawNominal = parseNominal(nominal);
    const rawPotongan = potongan ? parseNominal(potongan) : 0;

    const nominalBersih = rawNominal - rawPotongan;
    if (nominalBersih < 0)
      return res.status(400).json({ error: "Nominal bersih tidak boleh negatif" });

    const tanggal = formatTanggal();

    // 1. Insert data utama 
    const [result] = await conn.query(
      `INSERT INTO input_outgoing
(tanggal_outgoing, nominal, potongan_outgoing, nominal_bersih, jenis_pembayaran, status)
VALUES (?, ?, ?, ?, ?, 'active')`,
      [tanggal, rawNominal, rawPotongan, nominalBersih, outgoingValue]
    );

    const insertedId = result.insertId;

    // 2. Insert laporan pemasukan 
    await conn.query(
      `INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal)
VALUES (?, ?, ?)`,
      [tanggal, laporanValue, nominalBersih]
    );

    // 3. Potongan JFS 
    const potonganJFS = nominalBersih * 0.6;

    await conn.query(
      `INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal)
VALUES (?, 'Saldo JFS', ?)`,
      [tanggal, -potonganJFS]
    );

    // 4. Log dashboard 
    await conn.query(
      `INSERT INTO log_input_dashboard (id_input_outgoing) VALUES (?)`,
      [insertedId]
    );

    await conn.commit();

    res.json({
      message: "Outgoing berhasil ditambahkan",
      id_input_outgoing: insertedId
    });

  } catch (err) {
    await conn.rollback();
    console.error("Error inserting outgoing:", err);
    if (err.message && err.message.includes("Nominal")) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    conn.release();
  }
};

// input_outgoing.js

export const editOutgoing = async (req, res) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const { id_input_outgoing, nominal, potongan, jenis_pembayaran } = req.body;

    const [[old]] = await conn.query("SELECT * FROM input_outgoing WHERE id_input_outgoing = ?", [id_input_outgoing]);
    if (!old) return res.status(404).json({ error: "Data not found" });

    const { outgoingValue: outgoingBaru, laporanValue: laporanBaru } = normalizeJenisPembayaran(jenis_pembayaran);
    if (!outgoingBaru || !laporanBaru) {
      return res.status(400).json({ error: "Jenis pembayaran harus 'cash' atau 'transfer'" });
    }

    const { laporanValue: laporanOld } = normalizeJenisPembayaran(old.jenis_pembayaran);

    const rawNominal = parseNominal(nominal);
    const rawPotongan = potongan ? parseNominal(potongan) : 0;
    const nominalBersih = rawNominal - rawPotongan;
    if (nominalBersih < 0) return res.status(400).json({ error: "Nominal bersih tidak boleh negatif" });

    // --- PERBAIKAN: Gunakan tanggal asli dari data lama ---
    const tanggalAsli = old.tanggal_outgoing; 

    // 1. Update input_outgoing (Tanggal tetap menggunakan tanggalAsli)
    await conn.query(
      `UPDATE input_outgoing
       SET tanggal_outgoing = ?, nominal = ?, potongan_outgoing = ?, nominal_bersih = ?, jenis_pembayaran = ?
       WHERE id_input_outgoing = ?`,
      [tanggalAsli, rawNominal, rawPotongan, nominalBersih, outgoingBaru, id_input_outgoing]
    );

    // 2. Reverse transaksi lama (Hapus entri di laporan_keuangan berdasarkan data lama)
    if (laporanOld) {
      await conn.query(
        `DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = ? AND nominal = ?`,
        [old.tanggal_outgoing, laporanOld, old.nominal_bersih]
      );
    }
    await conn.query(
      `DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = 'Saldo JFS' AND nominal = ?`,
      [old.tanggal_outgoing, -(old.nominal_bersih * 0.6)]
    );

    // 3. Terapkan transaksi baru (Gunakan tanggalAsli agar tidak pindah ke hari ini)
    if (laporanBaru) {
      await conn.query(
        `INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, ?, ?)`,
        [tanggalAsli, laporanBaru, nominalBersih]
      );
    }
    await conn.query(
      `INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, 'Saldo JFS', ?)`,
      [tanggalAsli, -(nominalBersih * 0.6)]
    );

    // 4. Update log dashboard
    await conn.query(`DELETE FROM log_input_dashboard WHERE id_input_outgoing = ?`, [id_input_outgoing]);
    await conn.query(`INSERT INTO log_input_dashboard (id_input_outgoing) VALUES (?)`, [id_input_outgoing]);

    await conn.commit();
    res.json({ message: "Outgoing updated" });
  } catch (err) {
    await conn.rollback();
    console.error("Error updating outgoing:", err);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    conn.release();
  }
};

// SOFT DELETE (PUT /outgoing/delete)
export const deleteOutgoing = async (req, res) => {
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const { id_input_outgoing } = req.body;
    
    // 1. Ambil data lama dan pastikan status 'active'
    const [[data]] = await conn.query("SELECT * FROM input_outgoing WHERE id_input_outgoing = ? AND status = 'active'", [id_input_outgoing]);
    if (!data) return res.status(404).json({ error: "Data not found or already deleted" });

    // 2. Soft delete: Update status
    await conn.query("UPDATE input_outgoing SET status = 'deleted' WHERE id_input_outgoing = ?", [id_input_outgoing]);

    // 3. Reverse transaksi di laporan_keuangan (HAPUS entri)
    const { laporanValue: laporanOld } = normalizeJenisPembayaran(data.jenis_pembayaran);

    // Hapus laporan keuangan pemasukan (kas/transfer)
    if (laporanOld) {
      await conn.query(
        `DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = ? AND nominal = ?`,
        [data.tanggal_outgoing, laporanOld, data.nominal_bersih]
      );
    }

    // Hapus Saldo JFS
    await conn.query(
      `DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = 'Saldo JFS' AND nominal = ?`,
      [data.tanggal_outgoing, -(data.nominal_bersih * 0.6)]
    );

    // 4. Hapus log
    await conn.query("DELETE FROM log_input_dashboard WHERE id_input_outgoing = ?", [id_input_outgoing]);

    await conn.commit();
    res.json({ message: "Outgoing soft deleted" });
  } catch (err) {
    await conn.rollback();
    console.error("Error soft deleting outgoing:", err);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    conn.release();
  }
};

// GET TRASH 
export const getTrashOutgoing = async (req, res) => {
    try {
        const [results] = await pool.query(
            "SELECT * FROM input_outgoing WHERE status = 'deleted' ORDER BY tanggal_outgoing DESC"
        );
        res.json(results);
    } catch (err) {
        console.error("Error fetching trash outgoing:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// RESTORE (PUT /outgoing/restore)
export const restoreOutgoing = async (req, res) => {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
        const { id_input_outgoing } = req.body;

        // 1. Ambil data lama dan pastikan status 'deleted'
        const [[data]] = await conn.query("SELECT * FROM input_outgoing WHERE id_input_outgoing = ? AND status = 'deleted'", [id_input_outgoing]);
        if (!data) return res.status(404).json({ error: "Data not found or already active" });

        // 2. Restore: Update status menjadi 'active'
        await conn.query("UPDATE input_outgoing SET status = 'active' WHERE id_input_outgoing = ?", [id_input_outgoing]);
        
        // --- Terapkan kembali transaksi di laporan_keuangan (INSERT entri) ---
        
        const { laporanValue } = normalizeJenisPembayaran(data.jenis_pembayaran);
        const nominalBersih = data.nominal_bersih;
        const potonganJFS = nominalBersih * 0.6;
        const tanggal = data.tanggal_outgoing; // Gunakan tanggal aslinya

        // 3. Insert kembali laporan keuangan pemasukan (kas/transfer)
        if (laporanValue) {
            await conn.query(
                `INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, ?, ?)`,
                [tanggal, laporanValue, nominalBersih]
            );
        }

        // 4. Insert kembali Saldo JFS (negatif)
        await conn.query(
            `INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, 'Saldo JFS', ?)`,
            [tanggal, -potonganJFS]
        );

        // 5. Insert kembali log (DELETE dulu untuk mencegah duplikat)
        await conn.query(`DELETE FROM log_input_dashboard WHERE id_input_outgoing = ?`, [id_input_outgoing]);
        await conn.query(`INSERT INTO log_input_dashboard (id_input_outgoing) VALUES (?)`, [id_input_outgoing]);

        await conn.commit();
        res.json({ message: "Outgoing restored" });
    } catch (err) {
        await conn.rollback();
        console.error("Error restoring outgoing:", err);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        conn.release();
    }
};

export const deletePermanentOutgoing = async (req, res) => {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
        const { id_input_outgoing } = req.body;
        
        // 1. Ambil data lama (DIPERBAIKI UNTUK MENGHINDARI TypeError)
        const [results] = await conn.query("SELECT * FROM input_outgoing WHERE id_input_outgoing = ?", [id_input_outgoing]);
        const data = results && results.length > 0 ? results[0] : null;

        if (!data) {
            await conn.rollback();
            return res.status(404).json({ error: "Data not found" });
        }
// ======================== DELETE PERMANEN (DELETE /outgoing/delete-permanent) ========================
// export const deletePermanentOutgoing = async (req, res) => {
//     const conn = await pool.getConnection();
//     await conn.beginTransaction();

//     try {
//         const { id_input_outgoing } = req.body;
//         
//         // 1. Ambil data lama
//         const [[data]] = await conn.query("SELECT * FROM input_outgoing WHERE id_input_outgoing = ?", [id_input_outgoing]);
//         if (!data) return res.status(404).json({ error: "Data not found" });

        // 2. Reverse transaksi di laporan_keuangan (Hard Delete entri)
        const { laporanValue: laporanOld } = normalizeJenisPembayaran(data.jenis_pembayaran);

        // Hapus laporan keuangan pemasukan (kas/transfer)
        if (laporanOld) {
            await conn.query(
                `DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = ? AND nominal = ?`,
                [data.tanggal_outgoing, laporanOld, data.nominal_bersih]
            );
        }

        // Hapus Saldo JFS
        await conn.query(
            `DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = 'Saldo JFS' AND nominal = ?`,
            [data.tanggal_outgoing, -(data.nominal_bersih * 0.6)]
        );

        // 3. Hapus log
        await conn.query("DELETE FROM log_input_dashboard WHERE id_input_outgoing = ?", [id_input_outgoing]);
        
        // 4. Hapus input_outgoing secara permanen
        await conn.query("DELETE FROM input_outgoing WHERE id_input_outgoing = ?", [id_input_outgoing]);

        await conn.commit();
        res.json({ message: "Outgoing permanently deleted" });
    } catch (err) {
        await conn.rollback();
        console.error("Error permanently deleting outgoing:", err);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        conn.release();
    }
};