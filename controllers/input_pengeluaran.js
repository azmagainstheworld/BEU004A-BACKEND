import pool from "../config/dbconfig.js";

const formatTanggal = () => {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Makassar",
  });
};

const parseNominal = (nominal) => {
    const clean = String(nominal).replace(/\./g, "");
    const number = Number(clean);

    // Cek juga jika input bukan angka setelah cleaning (isNaN)
    if (isNaN(number) || number < 1000)
        throw new Error("Nominal minimal 1.000");

    return number;
};


const mapJenisTransaksi = (jenis_pembayaran) => {
    if (jenis_pembayaran === "Cash") return "Kas";
    if (jenis_pembayaran === "Transfer") return "Transfer";
    return null;
};

//  GET ALL
export const getAllPengeluaran = async (req, res) => {
    try {
        const userRoles = req.user?.roles || [];
        const todayStr = formatTanggal(); 

        if (userRoles.some(r => r.replace(/\s+/g, '').toLowerCase() === "superadmin")) {
            const query = `
                SELECT p.*, k.nama_karyawan
                FROM input_pengeluaran p
                LEFT JOIN karyawan k ON p.id_karyawan = k.id_karyawan
                WHERE p.status = 'active'
                ORDER BY p.tanggal_pengeluaran DESC
            `;
            const [rows] = await pool.query(query);
            return res.json(rows);

        } else if (userRoles.some(r => r.replace(/\s+/g, '').toLowerCase() === "admin")) {
            const query = `
                SELECT p.*, k.nama_karyawan
                FROM input_pengeluaran p
                LEFT JOIN karyawan k ON p.id_karyawan = k.id_karyawan
                WHERE p.status = 'active' AND DATE(p.tanggal_pengeluaran) = ?
                ORDER BY p.tanggal_pengeluaran DESC
            `;
            const [rows] = await pool.query(query, [todayStr]);
            return res.json(rows);

        } else {
            return res.status(403).json({ error: "Access denied" });
        }

    } catch (err) {
        console.error("Error fetching pengeluaran:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// INSERT 

export const insertPengeluaran = async (req, res) => {
    const userRoles = req.user?.roles || [];
    const isAuthorized = userRoles.some(r => {
        const roleClean = r.replace(/\s+/g, '').toLowerCase();
        return roleClean === "superadmin" || roleClean === "admin";
    });

    if (!isAuthorized) {
        return res.status(403).json({ error: "Akses ditolak: Hanya Admin dan Super Admin yang diizinkan" });
    }
    
    const conn = await pool.getConnection(); // ambil koneksi
    await conn.beginTransaction(); // Mulai transaksi

    try {
        const { nominal_pengeluaran, jenis_pengeluaran, jenis_pembayaran, deskripsi, id_karyawan } = req.body;

        if (!jenis_pengeluaran) throw new Error("Jenis pengeluaran wajib diisi");
        if (!jenis_pembayaran) throw new Error("Jenis pembayaran wajib diisi");
        if ((jenis_pengeluaran === "Operasional" || jenis_pengeluaran === "Lainnya") && !deskripsi)
            throw new Error("Deskripsi wajib diisi untuk Operasional/Lainnya");
        if (jenis_pengeluaran === "Kasbon" && !id_karyawan)
            throw new Error("Nama karyawan wajib diisi untuk Kasbon");

        // Validasi Nominal 
        const nominalParsed = parseNominal(nominal_pengeluaran);
        const tanggal = formatTanggal();
        const karyawanIdToInsert = jenis_pengeluaran === "Kasbon" ? id_karyawan : null;
        const deskripsiToInsert = (jenis_pengeluaran === "Operasional" || jenis_pengeluaran === "Lainnya") ? deskripsi : "-";

        const sqlInsert = `
            INSERT INTO input_pengeluaran (
                tanggal_pengeluaran, jenis_pengeluaran, jenis_pembayaran,
                nominal_pengeluaran, deskripsi, id_karyawan, status
            )
            VALUES (?, ?, ?, ?, ?, ?, 'active')
        `;

        // 1. Insert data utama (Gunakan conn.query)
        const [result] = await conn.query(sqlInsert, [
            tanggal, jenis_pengeluaran, jenis_pembayaran, nominalParsed,
            deskripsiToInsert, karyawanIdToInsert
        ]);

        const id_pengeluaran = result.insertId;
        const jenisTransaksi = mapJenisTransaksi(jenis_pembayaran);

        // 2. Logika Top Up Saldo JFS
        if (jenis_pengeluaran === "Top Up Saldo JFS") {
            await conn.query(
                `INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, 'Saldo JFS', ?)`,
                [tanggal, nominalParsed]
            );
        }

        // 3. Logika Pengurangan Kas/Transfer
        if (jenisTransaksi) {
            await conn.query(
                `INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, ?, ?)`,
                [tanggal, jenisTransaksi, -nominalParsed]
            );
        }

        // 4. Tambahkan log dashboard
        await conn.query(`INSERT INTO log_input_dashboard (id_input_pengeluaran) VALUES (?)`, [id_pengeluaran]);

        await conn.commit(); // Commit jika semua sukses
        res.status(201).json({ message: "Pengeluaran berhasil dibuat", id_pengeluaran });

    } catch (err) {
        await conn.rollback(); // Rollback jika ada kegagalan
        console.error("Error insert pengeluaran:", err);
        // Tangani Error Nominal/Validasi Khusus
        if (err.message && (err.message.includes("Nominal") || err.message.includes("wajib diisi"))) {
             return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        conn.release(); // Lepas koneksi
    }
};

// EDIT 

export const editPengeluaran = async (req, res) => {
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
        if (req.user?.role !== "Super Admin") {
       return res.status(403).json({ error: "Forbidden: Akses hanya untuk Super Admin" });
    }
        const { id_pengeluaran, nominal_pengeluaran, jenis_pengeluaran, jenis_pembayaran, deskripsi, id_karyawan } = req.body;

        const nominalParsed = parseNominal(nominal_pengeluaran);

        // 1. Ambil data lama untuk mendapatkan tanggal_pengeluaran asli
        const [[oldData]] = await conn.query(
            `SELECT * FROM input_pengeluaran WHERE id_input_pengeluaran = ?`, 
            [id_pengeluaran]
        );
        if (!oldData) { 
            await conn.rollback(); 
            return res.status(404).json({ error: "Data tidak ditemukan" }); 
        }

        const tanggalAsli = oldData.tanggal_pengeluaran; // <--- KUNCI: Gunakan tanggal lama
        const karyawanIdToInsert = jenis_pengeluaran === "Kasbon" ? id_karyawan : null;
        const deskripsiToInsert = (jenis_pengeluaran === "Operasional" || jenis_pengeluaran === "Lainnya") ? deskripsi : "-";

        // 2. Update data (Tanggal tetap tanggalAsli)
        await conn.query(
            `UPDATE input_pengeluaran SET 
                tanggal_pengeluaran = ?, nominal_pengeluaran = ?, jenis_pembayaran = ?, 
                jenis_pengeluaran = ?, deskripsi = ?, id_karyawan = ? 
             WHERE id_input_pengeluaran = ?`,
            [tanggalAsli, nominalParsed, jenis_pembayaran, jenis_pengeluaran, deskripsiToInsert, karyawanIdToInsert, id_pengeluaran]
        );

        // 3. Reverse laporan lama berdasarkan tanggal lama
        const oldJenisTransaksi = mapJenisTransaksi(oldData.jenis_pembayaran);
        if (oldData.jenis_pengeluaran === "Top Up Saldo JFS") {
            await conn.query(`DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = 'Saldo JFS' AND nominal = ?`, [tanggalAsli, oldData.nominal_pengeluaran]);
        }
        if (oldJenisTransaksi) {
            await conn.query(`DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = ? AND nominal = ?`, [tanggalAsli, oldJenisTransaksi, -oldData.nominal_pengeluaran]);
        }

        // 4. Insert laporan baru tetap di tanggalAsli
        const jenisTransaksi = mapJenisTransaksi(jenis_pembayaran);
        if (jenis_pengeluaran === "Top Up Saldo JFS") {
            await conn.query(`INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, 'Saldo JFS', ?)`, [tanggalAsli, nominalParsed]);
        }
        if (jenisTransaksi) {
            await conn.query(`INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, ?, ?)`, [tanggalAsli, jenisTransaksi, -nominalParsed]);
        }

        await conn.query(`DELETE FROM log_input_dashboard WHERE id_input_pengeluaran = ?`, [id_pengeluaran]);
        await conn.query(`INSERT INTO log_input_dashboard (id_input_pengeluaran) VALUES (?)`, [id_pengeluaran]);

        await conn.commit();
        res.json({ message: "Pengeluaran berhasil diupdate" });
    } catch (err) {
        await conn.rollback();
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        conn.release();
    }
};

// SOFT DELETE

export const deletePengeluaran = async (req, res) => {
    const conn = await pool.getConnection(); // Ambil koneksi
    await conn.beginTransaction(); // Mulai transaksi

    try {
        if (req.user?.role !== "Super Admin") {
       return res.status(403).json({ error: "Forbidden: Akses hanya untuk Super Admin" });
    }
        const { id_pengeluaran } = req.body;
        
        // 1. Ambil data lama dan pastikan status 'active' (Gunakan conn.query)
        const [[data]] = await conn.query(`SELECT * FROM input_pengeluaran WHERE id_input_pengeluaran = ? AND status = 'active'`, [id_pengeluaran]);
        if (!data) { await conn.rollback(); return res.status(404).json({ error: "Data not found or already deleted" }); }

        // 2. Soft delete: Update status
        await conn.query(`UPDATE input_pengeluaran SET status = 'deleted' WHERE id_input_pengeluaran = ?`, [id_pengeluaran]);

        // 3. Reverse transaksi di laporan_keuangan (DELETE entri)
        const { tanggal_pengeluaran, nominal_pengeluaran, jenis_pengeluaran, jenis_pembayaran } = data;
        const jenisTransaksi = mapJenisTransaksi(jenis_pembayaran);

        // Reverse Top Up Saldo JFS
        if (jenis_pengeluaran === "Top Up Saldo JFS") {
            await conn.query(`DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = 'Saldo JFS' AND nominal = ?`, [tanggal_pengeluaran, nominal_pengeluaran]);
        }
        
        // Reverse Pengurangan Kas/Transfer
        if (jenisTransaksi) {
            await conn.query(`DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = ? AND nominal = ?`, [tanggal_pengeluaran, jenisTransaksi, -nominal_pengeluaran]);
        }

        // 4. Hapus log dashboard
        await conn.query(`DELETE FROM log_input_dashboard WHERE id_input_pengeluaran = ?`, [id_pengeluaran]);

        await conn.commit(); // Commit jika semua sukses
        res.json({ message: "Pengeluaran soft deleted" });
    } catch (err) {
        await conn.rollback(); // Rollback jika ada kegagalan
        console.error("Error soft deleting pengeluaran:", err);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        conn.release(); // Lepas koneksi
    }
};

export const getTrashPengeluaran = async (req, res) => {
    try {
        if (req.user?.role !== "Super Admin") {
       return res.status(403).json({ error: "Forbidden: Akses hanya untuk Super Admin" });
    }
        const [rows] = await pool.query(`SELECT * FROM input_pengeluaran WHERE status = 'deleted' ORDER BY tanggal_pengeluaran DESC`);
        res.status(200).json(rows); 
    } catch (err) {
        console.error("Error fetching trash pengeluaran:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// RESTORE 

export const restorePengeluaran = async (req, res) => {
    const conn = await pool.getConnection(); 
    await conn.beginTransaction();

    try {
        if (req.user?.role !== "Super Admin") {
       return res.status(403).json({ error: "Forbidden: Akses hanya untuk Super Admin" });
    }
        const { id_input_pengeluaran } = req.body;

        const [[data]] = await conn.query(`SELECT * FROM input_pengeluaran WHERE id_input_pengeluaran = ? AND status = 'deleted'`, [id_input_pengeluaran]);
        if (!data) { await conn.rollback(); return res.status(404).json({ error: "Data not found or already active" }); }

        await conn.query(`UPDATE input_pengeluaran SET status = 'active' WHERE id_input_pengeluaran = ?`, [id_input_pengeluaran]);

        const { tanggal_pengeluaran, nominal_pengeluaran, jenis_pengeluaran, jenis_pembayaran } = data;
        const jenisTransaksi = mapJenisTransaksi(jenis_pembayaran);

        if (jenis_pengeluaran === "Top Up Saldo JFS") {
            await conn.query(`INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, 'Saldo JFS', ?)`, [tanggal_pengeluaran, nominal_pengeluaran]);
        }
        
        if (jenisTransaksi) {
            await conn.query(`INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, ?, ?)`, [tanggal_pengeluaran, jenisTransaksi, -nominal_pengeluaran]);
        }

        await conn.query(`DELETE FROM log_input_dashboard WHERE id_input_pengeluaran = ?`, [id_input_pengeluaran]);
        await conn.query(`INSERT INTO log_input_dashboard (id_input_pengeluaran) VALUES (?)`, [id_input_pengeluaran]);

        await conn.commit(); 
        res.json({ message: "Pengeluaran restored" });
    } catch (err) {
        await conn.rollback();
        console.error("Error restoring pengeluaran:", err);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        conn.release();
    }
};

// DELETE PERMANEN 

export const deletePermanentPengeluaran = async (req, res) => {
    const conn = await pool.getConnection(); 
    await conn.beginTransaction();

    try {
        if (req.user?.role !== "Super Admin") {
       return res.status(403).json({ error: "Forbidden: Akses hanya untuk Super Admin" });
    }

        const { id_input_pengeluaran } = req.body;

        const [[data]] = await conn.query(`SELECT * FROM input_pengeluaran WHERE id_input_pengeluaran = ?`, [id_input_pengeluaran]);
        if (!data) { await conn.rollback(); return res.status(404).json({ error: "Data not found" }); }

        const { tanggal_pengeluaran, nominal_pengeluaran, jenis_pengeluaran, jenis_pembayaran } = data;
        const jenisTransaksi = mapJenisTransaksi(jenis_pembayaran);

        if (jenis_pengeluaran === "Top Up Saldo JFS") {
            await conn.query(`DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = 'Saldo JFS' AND nominal = ?`, [tanggal_pengeluaran, nominal_pengeluaran]);
        }
        
        if (jenisTransaksi) {
            await conn.query(`DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = ? AND nominal = ?`, [tanggal_pengeluaran, jenisTransaksi, -nominal_pengeluaran]);
        }

        await conn.query(`DELETE FROM log_input_dashboard WHERE id_input_pengeluaran = ?`, [id_input_pengeluaran]);
        
        await conn.query(`DELETE FROM input_pengeluaran WHERE id_input_pengeluaran = ?`, [id_input_pengeluaran]);

        await conn.commit();
        res.json({ message: "Pengeluaran permanently deleted" });
    } catch (err) {
        await conn.rollback();
        console.error("Error permanently deleting pengeluaran:", err);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        conn.release();
    }
};