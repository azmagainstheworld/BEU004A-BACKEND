import pool from "../config/dbconfig.js";

const formatTanggal = () => {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Makassar",
  });
};

export const getAllDeliveryFee = async (req, res) => {
    try {
        const userRoles = req.user?.roles || [];
        const todayStr = formatTanggal(); 

        if (userRoles.some(r => r.replace(/\s+/g, '').toLowerCase() === "superadmin")) {
            const [results] = await pool.query("SELECT * FROM input_deliveryfee WHERE status = 'active' ORDER BY tanggal DESC");
            return res.json(results);
        } else if (userRoles.some(r => r.replace(/\s+/g, '').toLowerCase() === "admin")) {
            const [results] = await pool.query(
                "SELECT * FROM input_deliveryfee WHERE status = 'active' AND DATE(tanggal) = ? ORDER BY tanggal DESC",
                [todayStr]
            );
            return res.json(results);
        }
        return res.status(403).json({ error: "Access denied" });
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// ======================== INSERT (DENGAN TRANSAKSI) ========================
export const insertDeliveryFee = async (req, res) => {
    const role = req.user?.role;
    if (role !== "Super Admin" && role !== "Admin") {
        return res.status(403).json({ error: "Akses ditolak: Anda tidak memiliki izin untuk menambah data" });
    }
    
    let conn;
    try {
        const { nominal } = req.body;
        const tanggal = formatTanggal(); 
        const numericNominal = Number(String(nominal).replace(/\./g, ""));
        
        // Validasi
        if (isNaN(numericNominal) || numericNominal < 1000)
            return res.status(400).json({ error: "Nominal minimal Rp 1.000" });

        conn = await pool.getConnection();
        await conn.beginTransaction();

        // 1. Insert data utama
        const [result] = await conn.query(
            "INSERT INTO input_deliveryfee (tanggal, nominal, status) VALUES (?, ?, 'active')",
            [tanggal, numericNominal]
        );
        const id_deliveryfee = result.insertId;

        // 2. Insert Laporan Keuangan (Saldo JFS POSITIF)
        await conn.query(
            "INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, 'Saldo JFS', ?)",
            [tanggal, numericNominal]
        );

        // 3. Insert Log Dashboard
        await conn.query(
            "INSERT INTO log_input_dashboard (id_input_deliveryfee) VALUES (?)",
            [id_deliveryfee]
        );

        await conn.commit();
        res.status(201).json({ message: "Delivery fee inserted successfully", id: id_deliveryfee });
    } catch (err) {
        if (conn) await conn.rollback();
        console.error("Error inserting delivery fee:", err);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (conn) conn.release();
    }
};

// ======================== EDIT (DENGAN TRANSAKSI) ========================
export const editDeliveryFee = async (req, res) => {
    let conn;
    try {
        if (req.user?.role !== "Super Admin") {
       return res.status(403).json({ error: "Forbidden: Akses hanya untuk Super Admin" });
    }
        const { id_input_deliveryfee, nominal } = req.body;
        const numericNominal = Number(String(nominal).replace(/\./g, ""));

        // Validasi
        if (isNaN(numericNominal) || numericNominal <= 0)
            return res.status(400).json({ error: "Nominal harus berupa angka positif" });

        conn = await pool.getConnection();
        await conn.beginTransaction();

        // Ambil tanggal lama dari DB supaya tidak berubah
        const [rows] = await conn.query(
            "SELECT tanggal FROM input_deliveryfee WHERE id_input_deliveryfee = ?",
            [id_input_deliveryfee]
        );

        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: "Data not found" });
        }

        const tanggal = rows[0].tanggal; // gunakan tanggal lama

        // 1. Update data utama (nominal saja, tanggal tetap)
        const [updateResult] = await conn.query(
            "UPDATE input_deliveryfee SET tanggal = ?, nominal = ? WHERE id_input_deliveryfee = ?",
            [tanggal, numericNominal, id_input_deliveryfee]
        );

        if (updateResult.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ error: "Data not found" });
        }

        // 2. Update Laporan Keuangan (Hanya update nominal di entri Saldo JFS hari ini)
        await conn.query(
            "UPDATE laporan_keuangan SET nominal = ? WHERE DATE(tanggal) = DATE(?) AND jenis_transaksi = 'Saldo JFS'",
            [numericNominal, tanggal]
        );

        // 3. Update Log Dashboard (Delete dan Insert untuk me-refresh timestamp)
        await conn.query(
            "DELETE FROM log_input_dashboard WHERE id_input_deliveryfee = ?", 
            [id_input_deliveryfee]
        );
        await conn.query(
            "INSERT INTO log_input_dashboard (id_input_deliveryfee) VALUES (?)",
            [id_input_deliveryfee]
        );

        await conn.commit();
        res.status(200).json({ message: "Delivery fee updated successfully" });
    } catch (err) {
        if (conn) await conn.rollback();
        console.error("Error updating delivery fee:", err);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (conn) conn.release();
    }
};


// ======================== SOFT DELETE (DENGAN TRANSAKSI) ========================
export const deleteDeliveryFee = async (req, res) => {
    let conn;
    try {
        if (req.user?.role !== "Super Admin") {
       return res.status(403).json({ error: "Forbidden: Akses hanya untuk Super Admin" });
    }
        const { id_input_deliveryfee } = req.body;

        conn = await pool.getConnection();
        await conn.beginTransaction();

        // 1. Ambil data lama
        const [results] = await conn.query(
            "SELECT tanggal, nominal FROM input_deliveryfee WHERE id_input_deliveryfee = ? AND status = 'active'",
            [id_input_deliveryfee]
        );
        const data = results && results.length > 0 ? results[0] : null;

        if (!data) {
            await conn.rollback();
            return res.status(404).json({ error: "Data not found or already deleted" });
        }

        // 2. Soft delete record DF
        await conn.query(
            "UPDATE input_deliveryfee SET status = 'deleted' WHERE id_input_deliveryfee = ?",
            [id_input_deliveryfee]
        );

        // 3. Reverse data di Laporan Keuangan (DELETE entri)
        await conn.query(
            "DELETE FROM laporan_keuangan WHERE DATE(tanggal) = DATE(?) AND jenis_transaksi = 'Saldo JFS' AND nominal = ?",
            [data.tanggal, data.nominal]
        );

        // 4. Hapus Log Dashboard
        await conn.query(
            "DELETE FROM log_input_dashboard WHERE id_input_deliveryfee = ?",
            [id_input_deliveryfee]
        );

        await conn.commit();
        res.status(200).json({ message: "Soft delete berhasil, data keuangan di-reverse" });
    } catch (err) {
        if (conn) await conn.rollback();
        console.error("Error soft deleting delivery fee:", err);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (conn) conn.release();
    }
};

// ======================== GET TRASH ========================
export const getTrashDeliveryFee = async (req, res) => {
    try {
        if (req.user?.role !== "Super Admin") {
       return res.status(403).json({ error: "Forbidden: Akses hanya untuk Super Admin" });
    }
        const [results] = await pool.query(
            "SELECT * FROM input_deliveryfee WHERE status = 'deleted' ORDER BY tanggal DESC"
        );
        res.status(200).json(results);
    } catch (err) {
        console.error("Error fetching trash delivery fee:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// ======================== RESTORE (DENGAN TRANSAKSI) ========================
export const restoreDeliveryFee = async (req, res) => {
    let conn;
    try {
        if (req.user?.role !== "Super Admin") {
       return res.status(403).json({ error: "Forbidden: Akses hanya untuk Super Admin" });
    }
        const { id_input_deliveryfee } = req.body;

        conn = await pool.getConnection();
        await conn.beginTransaction();

        // 1. Ambil data lama
        const [results] = await conn.query(
            "SELECT tanggal, nominal FROM input_deliveryfee WHERE id_input_deliveryfee = ? AND status = 'deleted'",
            [id_input_deliveryfee]
        );
        const data = results && results.length > 0 ? results[0] : null;

        if (!data) {
            await conn.rollback();
            return res.status(404).json({ error: "Data not found or already active" });
        }

        // 2. Restore record DF
        await conn.query(
            "UPDATE input_deliveryfee SET status = 'active' WHERE id_input_deliveryfee = ?",
            [id_input_deliveryfee]
        );

        // 3. Re-apply data di Laporan Keuangan (INSERT entri)
        await conn.query(
            "INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, 'Saldo JFS', ?)",
            [data.tanggal, data.nominal]
        );

        // 4. Insert Log Dashboard
        await conn.query(
            "INSERT INTO log_input_dashboard (id_input_deliveryfee) VALUES (?)",
            [id_input_deliveryfee]
        );

        await conn.commit();
        res.status(200).json({ message: "Restore berhasil, data keuangan diaplikasikan kembali" });
    } catch (err) {
        if (conn) await conn.rollback();
        console.error("Error restoring delivery fee:", err);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (conn) conn.release();
    }
};

// ======================== DELETE PERMANENT (DENGAN TRANSAKSI) ========================
export const deletePermanentDeliveryFee = async (req, res) => {
    let conn;
    try {
        if (req.user?.role !== "Super Admin") {
       return res.status(403).json({ error: "Forbidden: Akses hanya untuk Super Admin" });
    }
        const { id_input_deliveryfee } = req.body;

        conn = await pool.getConnection();
        await conn.beginTransaction();

        // 1. Ambil data lama
        const [results] = await conn.query(
            "SELECT tanggal, nominal FROM input_deliveryfee WHERE id_input_deliveryfee = ?",
            [id_input_deliveryfee]
        );
        const data = results && results.length > 0 ? results[0] : null;

        if (!data) {
            await conn.rollback();
            return res.status(404).json({ error: "Data not found" });
        }

        // 2. Hapus dari input_deliveryfee
        await conn.query(
            "DELETE FROM input_deliveryfee WHERE id_input_deliveryfee = ?",
            [id_input_deliveryfee]
        );

        // 3. Hapus entri laporan keuangan
        await conn.query(
            "DELETE FROM laporan_keuangan WHERE DATE(tanggal) = DATE(?) AND jenis_transaksi = 'Saldo JFS' AND nominal = ?",
            [data.tanggal, data.nominal]
        );

        // 4. Hapus Log Dashboard
        await conn.query(
            "DELETE FROM log_input_dashboard WHERE id_input_deliveryfee = ?",
            [id_input_deliveryfee]
        );

        await conn.commit();
        res.status(200).json({ message: "Delete permanen berhasil" });
    } catch (err) {
        if (conn) await conn.rollback();
        console.error("Error deleting delivery fee permanently:", err);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        if (conn) conn.release();
    }
};
