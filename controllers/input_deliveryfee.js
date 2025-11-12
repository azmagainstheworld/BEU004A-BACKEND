import pool from "../config/dbconfig.js";

export const getAllDeliveryFee = async (req, res) => {
  try {
    const userRoles = req.user?.roles || [];

    let query;
    if (userRoles.some(r => r.replace(/\s+/g,'').toLowerCase() === "superadmin")) {
      query = "SELECT * FROM input_deliveryfee ORDER BY tanggal DESC";
    } else if (userRoles.some(r => r.replace(/\s+/g,'').toLowerCase() === "admin")) {
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

export const insertDeliveryFee = async (req, res) => {
  try {
    const { nominal } = req.body;
    const tanggal = new Date();

    const numericNominal = Number(String(nominal).replace(/\./g, ""));
    if (isNaN(numericNominal) || numericNominal <= 0)
      return res.status(400).json({ error: "Nominal harus berupa angka positif" });

    const [result] = await pool.query(
      "INSERT INTO input_deliveryfee (tanggal, nominal) VALUES (?, ?)",
      [tanggal, numericNominal]
    );
    const id_deliveryfee = result.insertId;

    await pool.query(
      "INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, 'Saldo JFS', ?)",
      [tanggal, numericNominal]
    );

    await pool.query(
      "INSERT INTO log_input_dashboard (id_input_deliveryfee) VALUES (?)",
      [id_deliveryfee]
    );

    res.status(201).json({ message: "Delivery fee inserted successfully", id: id_deliveryfee });
  } catch (err) {
    console.error("Error inserting delivery fee:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const editDeliveryFee = async (req, res) => {
  try {
    const { id_input_deliveryfee, nominal } = req.body;
    const tanggal = new Date();

    const numericNominal = Number(String(nominal).replace(/\./g, ""));
    if (isNaN(numericNominal) || numericNominal <= 0)
      return res.status(400).json({ error: "Nominal harus berupa angka positif" });

    // Update nominal & tanggal di tabel input_deliveryfee
    const [updateResult] = await pool.query(
      "UPDATE input_deliveryfee SET tanggal = ?, nominal = ? WHERE id_input_deliveryfee = ?",
      [tanggal, numericNominal, id_input_deliveryfee]
    );
    if (updateResult.affectedRows === 0)
      return res.status(404).json({ error: "Data not found" });

    // Update laporan_keuangan
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

export const deleteDeliveryFee = async (req, res) => {
  try {
    const { id_input_deliveryfee } = req.body;

    const [[data]] = await pool.query(
      "SELECT tanggal, nominal FROM input_deliveryfee WHERE id_input_deliveryfee = ?",
      [id_input_deliveryfee]
    );
    if (!data) return res.status(404).json({ error: "Data not found" });

    await pool.query(
      "DELETE FROM input_deliveryfee WHERE id_input_deliveryfee = ?",
      [id_input_deliveryfee]
    );

    await pool.query(
      "DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = 'Saldo JFS' AND nominal = ?",
      [data.tanggal, data.nominal]
    );

    await pool.query(
      "DELETE FROM log_input_dashboard WHERE id_input_deliveryfee = ?",
      [id_input_deliveryfee]
    );

    res.status(200).json({ message: "Delivery fee deleted successfully" });
  } catch (err) {
    console.error("Error deleting delivery fee:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
