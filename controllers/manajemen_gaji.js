const db = require('../config/dbconfig');

// GET all manajemen gaji
exports.getAllManajemenGaji = (req, res) => {
  const query = `
    SELECT mg.*, k.nama_karyawan
    FROM manajemen_gaji mg
    JOIN karyawan k ON mg.id_karyawan = k.id_karyawan
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching manajemen gaji data:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    res.json(results);
  });
};

// GET manajemen gaji by ID
exports.getManajemenGajiById = (req, res) => {
  const { id } = req.params;
  db.query("SELECT * FROM manajemen_gaji WHERE id_manajemen_gaji = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ error: "Internal Server Error" });
    if (results.length === 0) return res.status(404).json({ error: "Data not found" });
    res.json(results[0]);
  });
};

// CREATE new manajemen gaji
exports.createManajemenGaji = (req, res) => {
  const { id_karyawan, upah_perhari, bonus } = req.body;
  db.query(
    "INSERT INTO manajemen_gaji (id_karyawan, upah_perhari, bonus) VALUES (?, ?, ?)",
    [id_karyawan, upah_perhari, bonus],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Internal Server Error" });
      res.status(201).json({ message: "Manajemen gaji created", id: results.insertId });
    }
  );
};

// UPDATE manajemen gaji
exports.updateManajemenGaji = (req, res) => {
  const { id } = req.params;
  const { id_karyawan, upah_perhari, bonus } = req.body;
  db.query(
    "UPDATE manajemen_gaji SET id_karyawan = ?, upah_perhari = ?, bonus = ? WHERE id_manajemen_gaji = ?",
    [id_karyawan, upah_perhari, bonus, id],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Internal Server Error" });
      if (results.affectedRows === 0) return res.status(404).json({ error: "Data not found" });
      res.json({ message: "Manajemen gaji updated" });
    }
  );
};

// DELETE manajemen gaji
exports.deleteManajemenGaji = (req, res) => {
  const { id } = req.params;

  db.query("DELETE FROM manajemen_gaji WHERE id_manajemen_gaji = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ error: "Internal Server Error" });
    if (results.affectedRows === 0) return res.status(404).json({ error: "Data not found" });
    res.json({ message: "Manajemen gaji deleted" });
  });
};
