const db = require('../config/dbconfig');

exports.getAllOutgoing = (req, res) => {
  db.query("SELECT * FROM input_outgoing", (err, results) => {
    if (err) {
      console.error("Error fetching outgoing data:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    res.json(results);
  });
};

exports.getOutgoingById = (req, res) => {
  const { id } = req.body;
  db.query("SELECT * FROM input_outgoing WHERE id_input_outgoing = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ error: "Internal Server Error" });
    if (results.length === 0) return res.status(404).json({ error: "Data not found" });
    res.json(results[0]);
  });
};

exports.createOutgoing = (req, res) => {
  const { tanggal_outgoing, jenis_pembayaran, nominal, deskripsi } = req.body;
  db.query(
    "INSERT INTO input_outgoing (tanggal_outgoing, jenis_pembayaran, nominal, deskripsi) VALUES (?, ?, ?, ?)",
    [tanggal_outgoing, jenis_pembayaran, nominal, deskripsi],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Internal Server Error" });
      res.status(201).json({ message: "Outgoing created", id: results.insertId });
    });
};

exports.updateOutgoing = (req, res) => {
  const { id, tanggal_outgoing, jenis_pembayaran, nominal, deskripsi } = req.body;
  db.query(
    "UPDATE input_outgoing SET tanggal_outgoing = ?, jenis_pembayaran = ?, nominal = ?, deskripsi = ? WHERE id_input_outgoing = ?",
    [tanggal_outgoing, jenis_pembayaran, nominal, deskripsi, id],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Internal Server Error" });
      if (results.affectedRows === 0) return res.status(404).json({ error: "Data not found" });
      res.json({ message: "Outgoing updated" });
    });
};

exports.deleteOutgoing = (req, res) => {
  const { id } = req.body;
  db.query("DELETE FROM input_outgoing WHERE id_input_outgoing = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ error: "Internal Server Error" });
    if (results.affectedRows === 0) return res.status(404).json({ error: "Data not found" });
    res.json({ message: "Outgoing deleted" });
  });
};
