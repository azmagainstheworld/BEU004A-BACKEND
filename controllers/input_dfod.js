const db = require('../config/dbconfig');

// GET all DFOD records
exports.getAllDFOD = (req, res) => {
  db.query("SELECT * FROM input_dfod", (err, results) => {
    if (err) {
      console.error("Error fetching DFOD data:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    res.json(results);
  });
};

// GET DFOD by ID
exports.getDFODById = (req, res) => {
  const { id } = req.body;
  db.query("SELECT * FROM input_dfod WHERE id_input_dfod = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ error: "Internal Server Error" });
    if (results.length === 0) return res.status(404).json({ error: "Data not found" });
    res.json(results[0]);
  });
};

// CREATE new DFOD
exports.createDFOD = (req, res) => {
  const { tanggal_dfod, jenis_pembayaran, nominal } = req.body;
  db.query(
    "INSERT INTO input_dfod (tanggal_dfod, jenis_pembayaran, nominal) VALUES (?, ?, ?)",
    [tanggal_dfod, jenis_pembayaran, nominal],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Internal Server Error" });
      res.status(201).json({ message: "DFOD created", id: results.insertId });
    });
};

// UPDATE DFOD
exports.updateDFOD = (req, res) => {
  const { id, tanggal_dfod, jenis_pembayaran, nominal } = req.body;
  db.query(
    "UPDATE input_dfod SET tanggal_dfod = ?, jenis_pembayaran = ?, nominal = ? WHERE id_input_dfod = ?",
    [tanggal_dfod, jenis_pembayaran, nominal, id],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Internal Server Error" });
      if (results.affectedRows === 0) return res.status(404).json({ error: "Data not found" });
      res.json({ message: "DFOD updated" });
    }
  );
};

// DELETE DFOD
exports.deleteDFOD = (req, res) => {
  const { id } = req.body;
  db.query("DELETE FROM input_dfod WHERE id_input_dfod = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ error: "Internal Server Error" });
    if (results.affectedRows === 0) return res.status(404).json({ error: "Data not found" });
    res.json({ message: "DFOD deleted" });
  });
};
