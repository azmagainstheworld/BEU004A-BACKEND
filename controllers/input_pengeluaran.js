const db = require('../config/dbconfig');

// GET all pengeluaran records
exports.getAllPengeluaran = (req, res) => {
  db.query("SELECT * FROM input_pengeluaran", (err, results) => {
    if (err) {
      console.error("Error fetching pengeluaran data:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    res.json(results);
  });
};

// GET pengeluaran by ID
exports.getPengeluaranById = (req, res) => {
  const { id } = req.body;
  db.query("SELECT * FROM input_pengeluaran WHERE id_input_pengeluaran = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ error: "Internal Server Error" });
    if (results.length === 0) return res.status(404).json({ error: "Data not found" });
    res.json(results[0]);
  });
};

// CREATE new pengeluaran
exports.createPengeluaran = (req, res) => {
  const { tanggal_pengeluaran, jenis_pembayaran, nominal, deskripsi } = req.body;
  db.query(
    "INSERT INTO input_pengeluaran (tanggal_pengeluaran, jenis_pembayaran, nominal, deskripsi) VALUES (?, ?, ?, ?)",
    [tanggal_pengeluaran, jenis_pembayaran, nominal, deskripsi],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Internal Server Error" });
      res.status(201).json({ message: "Pengeluaran created", id: results.insertId });
    });
};

// UPDATE pengeluaran
exports.updatePengeluaran = (req, res) => {
  const { id, tanggal_pengeluaran, jenis_pembayaran, nominal, deskripsi } = req.body;
  db.query(
    "UPDATE input_pengeluaran SET tanggal_pengeluaran = ?, jenis_pembayaran = ?, nominal = ?, deskripsi = ? WHERE id_input_pengeluaran = ?",
    [tanggal_pengeluaran, jenis_pembayaran, nominal, deskripsi, id],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Internal Server Error" });
      if (results.affectedRows === 0) return res.status(404).json({ error: "Data not found" });
      res.json({ message: "Pengeluaran updated" });
    });
};

// DELETE pengeluaran
exports.deletePengeluaran = (req, res) => {
  const { id } = req.body;
  db.query("DELETE FROM input_pengeluaran WHERE id_input_pengeluaran = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ error: "Internal Server Error" });
    if (results.affectedRows === 0) return res.status(404).json({ error: "Data not found" });
    res.json({ message: "Pengeluaran deleted" });
  });
};
