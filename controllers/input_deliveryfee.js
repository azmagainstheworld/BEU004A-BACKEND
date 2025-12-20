// import pool from "../config/dbconfig.js";

// // ======================== UTILITY ========================
// const formatTanggal = () => {
//   const now = new Date();
//   const year = now.getFullYear();
//   const month = String(now.getMonth() + 1).padStart(2, "0");
//   const day = String(now.getDate()).padStart(2, "0");
//   return `${year}-${month}-${day}`; // yyyy-mm-dd lokal
// };

// // Jika mau full datetime lokal
// const formatDatetimeLocal = () => {
//   const now = new Date();
//   const year = now.getFullYear();
//   const month = String(now.getMonth() + 1).padStart(2, "0");
//   const day = String(now.getDate()).padStart(2, "0");
//   const hours = String(now.getHours()).padStart(2, "0");
//   const minutes = String(now.getMinutes()).padStart(2, "0");
//   const seconds = String(now.getSeconds()).padStart(2, "0");
//   return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
// };

// // ======================== GET ALL (LOG AKTIF) ========================
// export const getAllDeliveryFee = async (req, res) => {
//   try {
//     const userRoles = req.user?.roles || [];
//     let query;

//     if (userRoles.some(r => r.replace(/\s+/g, '').toLowerCase() === "superadmin")) {
//       query = "SELECT * FROM input_deliveryfee WHERE status = 'active' ORDER BY tanggal DESC";
//     } else if (userRoles.some(r => r.replace(/\s+/g, '').toLowerCase() === "admin")) {
//       query = "SELECT * FROM input_deliveryfee WHERE status = 'active' AND DATE(tanggal) = CURDATE() ORDER BY tanggal DESC";
//     } else {
//       return res.status(403).json({ error: "Access denied" });
//     }

//     const [results] = await pool.query(query);
//     res.json(results);
//   } catch (err) {
//     console.error("Error fetching delivery fee:", err);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };

// // ======================== INSERT ========================
// export const insertDeliveryFee = async (req, res) => {
//   try {
//     const { nominal } = req.body;
//     const tanggal = formatTanggal(); // tanggal lokal
//     const numericNominal = Number(String(nominal).replace(/\./g, ""));
//     if (isNaN(numericNominal) || numericNominal < 1000)
//       return res.status(400).json({ error: "Nominal minimal Rp 1.000" });

//     const [result] = await pool.query(
//       "INSERT INTO input_deliveryfee (tanggal, nominal, status) VALUES (?, ?, 'active')",
//       [tanggal, numericNominal]
//     );
//     const id_deliveryfee = result.insertId;

//     await pool.query(
//       "INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, 'Saldo JFS', ?)",
//       [tanggal, numericNominal]
//     );

//     await pool.query(
//       "INSERT INTO log_input_dashboard (id_input_deliveryfee) VALUES (?)",
//       [id_deliveryfee]
//     );

//     res.status(201).json({ message: "Delivery fee inserted successfully", id: id_deliveryfee });
//   } catch (err) {
//     console.error("Error inserting delivery fee:", err);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };

// // ======================== EDIT ========================
// export const editDeliveryFee = async (req, res) => {
//   try {
//     const { id_input_deliveryfee, nominal } = req.body;
//     const tanggal = formatTanggal(); // tanggal lokal
//     const numericNominal = Number(String(nominal).replace(/\./g, ""));
//     if (isNaN(numericNominal) || numericNominal <= 0)
//       return res.status(400).json({ error: "Nominal harus berupa angka positif" });

//     const [updateResult] = await pool.query(
//       "UPDATE input_deliveryfee SET tanggal = ?, nominal = ? WHERE id_input_deliveryfee = ?",
//       [tanggal, numericNominal, id_input_deliveryfee]
//     );

//     if (updateResult.affectedRows === 0)
//       return res.status(404).json({ error: "Data not found" });

//     await pool.query(
//       "UPDATE laporan_keuangan SET nominal = ? WHERE DATE(tanggal) = DATE(?) AND jenis_transaksi = 'Saldo JFS'",
//       [numericNominal, tanggal]
//     );

//     await pool.query(
//       "DELETE FROM log_input_dashboard WHERE id_input_deliveryfee = ?", 
//       [id_input_deliveryfee]
//     );
//     await pool.query(
//       "INSERT INTO log_input_dashboard (id_input_deliveryfee) VALUES (?)",
//       [id_input_deliveryfee]
//     );

//     res.status(200).json({ message: "Delivery fee updated successfully" });
//   } catch (err) {
//     console.error("Error updating delivery fee:", err);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };

// // ======================== SOFT DELETE ========================
// export const deleteDeliveryFee = async (req, res) => {
//   try {
//     const { id_input_deliveryfee } = req.body;

//     const [[data]] = await pool.query(
//       "SELECT tanggal, nominal FROM input_deliveryfee WHERE id_input_deliveryfee = ? AND status = 'active'",
//       [id_input_deliveryfee]
//     );
//     if (!data) return res.status(404).json({ error: "Data not found or already deleted" });

//     await pool.query(
//       "UPDATE input_deliveryfee SET status = 'deleted' WHERE id_input_deliveryfee = ?",
//       [id_input_deliveryfee]
//     );

//     await pool.query(
//       "DELETE FROM laporan_keuangan WHERE DATE(tanggal) = DATE(?) AND jenis_transaksi = 'Saldo JFS' AND nominal = ?",
//       [data.tanggal, data.nominal]
//     );

//     await pool.query(
//       "DELETE FROM log_input_dashboard WHERE id_input_deliveryfee = ?",
//       [id_input_deliveryfee]
//     );

//     res.status(200).json({ message: "Soft delete berhasil, data keuangan di-reverse" });
//   } catch (err) {
//     console.error("Error soft deleting delivery fee:", err);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };

// // ======================== GET TRASH ========================
// export const getTrashDeliveryFee = async (req, res) => {
//   try {
//     const [results] = await pool.query(
//       "SELECT * FROM input_deliveryfee WHERE status = 'deleted' ORDER BY tanggal DESC"
//     );
//     res.status(200).json(results);
//   } catch (err) {
//     console.error("Error fetching trash delivery fee:", err);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };

// // ======================== RESTORE ========================
// export const restoreDeliveryFee = async (req, res) => {
//   try {
//     const { id_input_deliveryfee } = req.body;

//     const [[data]] = await pool.query(
//       "SELECT tanggal, nominal FROM input_deliveryfee WHERE id_input_deliveryfee = ? AND status = 'deleted'",
//       [id_input_deliveryfee]
//     );
//     if (!data) return res.status(404).json({ error: "Data not found or already active" });

//     await pool.query(
//       "UPDATE input_deliveryfee SET status = 'active' WHERE id_input_deliveryfee = ?",
//       [id_input_deliveryfee]
//     );

//     await pool.query(
//       "INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, 'Saldo JFS', ?)",
//       [data.tanggal, data.nominal]
//     );

//     await pool.query(
//       "INSERT INTO log_input_dashboard (id_input_deliveryfee) VALUES (?)",
//       [id_input_deliveryfee]
//     );

//     res.status(200).json({ message: "Restore berhasil, data keuangan diaplikasikan kembali" });
//   } catch (err) {
//     console.error("Error restoring delivery fee:", err);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };

// // ======================== DELETE PERMANENT ========================
// export const deletePermanentDeliveryFee = async (req, res) => {
//   try {
//     const { id_input_deliveryfee } = req.body;

//     const [[data]] = await pool.query(
//       "SELECT tanggal, nominal FROM input_deliveryfee WHERE id_input_deliveryfee = ?",
//       [id_input_deliveryfee]
//     );
//     if (!data) return res.status(404).json({ error: "Data not found" });

//     await pool.query(
//       "DELETE FROM input_deliveryfee WHERE id_input_deliveryfee = ?",
//       [id_input_deliveryfee]
//     );

//     await pool.query(
//       "DELETE FROM laporan_keuangan WHERE DATE(tanggal) = DATE(?) AND jenis_transaksi = 'Saldo JFS' AND nominal = ?",
//       [data.tanggal, data.nominal]
//     );

//     await pool.query(
//       "DELETE FROM log_input_dashboard WHERE id_input_deliveryfee = ?",
//       [id_input_deliveryfee]
//     );

//     res.status(200).json({ message: "Delete permanen berhasil" });
//   } catch (err) {
//     console.error("Error deleting delivery fee permanently:", err);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };

import pool from "../config/dbconfig.js";

// ======================== UTILITY ========================
const formatTanggal = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`; // yyyy-mm-dd lokal
};

// ======================== GET ALL (LOG AKTIF) ========================
export const getAllDeliveryFee = async (req, res) => {
    try {
        const userRoles = req.user?.roles || [];
        let query;

        if (userRoles.some(r => r.replace(/\s+/g, '').toLowerCase() === "superadmin")) {
            query = "SELECT * FROM input_deliveryfee WHERE status = 'active' ORDER BY tanggal DESC";
        } else if (userRoles.some(r => r.replace(/\s+/g, '').toLowerCase() === "admin")) {
            query = "SELECT * FROM input_deliveryfee WHERE status = 'active' AND DATE(tanggal) = CURDATE() ORDER BY tanggal DESC";
        } else {
            return res.status(403).json({ error: "Access denied" });
        }

        const [results] = await pool.query(query);
        res.json(results);
    } catch (err) {
        console.error("Error fetching delivery fee:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// ======================== INSERT (DENGAN TRANSAKSI) ========================
export const insertDeliveryFee = async (req, res) => {
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
