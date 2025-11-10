import pool from "../config/dbconfig.js";

export const getAllDeliveryFee = async (req, res) => {
  try {
    const userRoles = req.user?.roles || []; // selalu array

    let query;

    if (userRoles.some(r => r.replace(/\s+/g,'').toLowerCase() === "superadmin")) {
      // SuperAdmin: semua tanggal
      query = "SELECT * FROM input_deliveryfee ORDER BY tanggal DESC";
    } else if (userRoles.some(r => r.replace(/\s+/g,'').toLowerCase() === "admin")) {
      // Admin: hanya hari ini
      query = "SELECT * FROM input_deliveryfee WHERE DATE(tanggal) = CURDATE() ORDER BY tanggal DESC";
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


// ✅ INSERT Delivery Fee (tanpa id_user, tapi tetap update laporan_keuangan)
export const insertDeliveryFee = async (req, res) => {
  try {
    const { nominal } = req.body;
    const tanggal = new Date();

    // ✅ Validasi nominal
    const cleanNominal = String(nominal).replace(/\./g, "");
    const numericNominal = Number(cleanNominal);
    if (isNaN(numericNominal) || numericNominal <= 0)
      return res.status(400).json({ error: "Nominal harus berupa angka positif" });

    // 🔹 Simpan ke tabel input_deliveryfee
    const [results] = await pool.query(
      "INSERT INTO input_deliveryfee (tanggal, nominal) VALUES (?, ?)",
      [tanggal, numericNominal]
    );

    // 🔹 Tambahkan ke laporan_keuangan (saldo JFS)
    await pool.query(
      "INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, 'Saldo JFS', ?)",
      [tanggal, numericNominal]
    );

    res
      .status(200)
      .json({ message: "Delivery fee inserted successfully", id: results.insertId });
  } catch (err) {
    console.error("Error inserting delivery fee:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


// 🔹 EDIT Delivery Fee (update otomatis di laporan keuangan juga)
export const editDeliveryFee = async (req, res) => {
  try {
    const { id_input_deliveryfee, nominal } = req.body;
    const tanggal = new Date();

    const cleanNominal = String(nominal).replace(/\./g, "");
    const numericNominal = Number(cleanNominal);
    if (isNaN(numericNominal) || numericNominal <= 0)
      return res.status(400).json({ error: "Nominal harus berupa angka positif" });

    const [results] = await pool.query(
      "UPDATE input_deliveryfee SET tanggal = ?, nominal = ? WHERE id_input_deliveryfee = ?",
      [tanggal, numericNominal, id_input_deliveryfee]
    );

    if (results.affectedRows === 0)
      return res.status(404).json({ error: "Data not found" });

    // 🔹 Update laporan_keuangan (hanya yang punya tanggal sama dan jenis saldo_jfs)
    await pool.query(
      "UPDATE laporan_keuangan SET nominal = ? WHERE tanggal = CURDATE() AND jenis_transaksi = 'Saldo JFS'",
      [numericNominal]
    );

    res.status(200).json({ message: "Delivery fee updated successfully" });
  } catch (err) {
    console.error("Error updating delivery fee:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 🔹 DELETE Delivery Fee (hapus dari laporan keuangan juga)
export const deleteDeliveryFee = async (req, res) => {
  try {
    const { id_input_deliveryfee } = req.body;

    // Ambil nominal & tanggal sebelum hapus
    const [[data]] = await pool.query(
      "SELECT tanggal, nominal FROM input_deliveryfee WHERE id_input_deliveryfee = ?",
      [id_input_deliveryfee]
    );

    if (!data)
      return res.status(404).json({ error: "Data not found" });

    // Hapus delivery fee
    const [results] = await pool.query(
      "DELETE FROM input_deliveryfee WHERE id_input_deliveryfee = ?",
      [id_input_deliveryfee]
    );

    // Hapus juga dari laporan keuangan
    await pool.query(
      "DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = 'Saldo JFS' AND nominal = ?",
      [data.tanggal, data.nominal_deliveryfee]
    );

    res.status(200).json({ message: "Delivery fee deleted successfully" });
  } catch (err) {
    console.error("Error deleting delivery fee:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
