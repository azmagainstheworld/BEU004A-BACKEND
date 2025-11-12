import pool from "../config/dbconfig.js";

const parseNominal = (nominal) => {
  const clean = String(nominal).replace(/\./g, "");
  const number = Number(clean);
  if (isNaN(number) || number <= 0) throw new Error("Nominal harus berupa angka positif");
  return number;
};

const formatTanggal = () => {
  return new Date().toISOString().split("T")[0]; 
};

const mapJenisTransaksi = (jenis_pembayaran) => {
  if (jenis_pembayaran === "Cash") return "Kas";
  if (jenis_pembayaran === "Transfer") return "Transfer";
  return null;
};

export const getAllDFOD = async (req, res) => {
  try {
    const userRoles = req.user?.roles || [];
    let query;

    if (userRoles.some(r => r.replace(/\s+/g, '').toLowerCase() === "superadmin")) {
      query = "SELECT * FROM input_dfod ORDER BY tanggal_dfod DESC";
    } else if (userRoles.some(r => r.replace(/\s+/g, '').toLowerCase() === "admin")) {
      query = "SELECT * FROM input_dfod WHERE tanggal_dfod = CURDATE() ORDER BY tanggal_dfod DESC";
    } else {
      return res.status(403).json({ error: "Access denied" });
    }

    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching DFOD:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getDFODById = async (req, res) => {
  try {
    const { id_input_dfod } = req.body;
    const [rows] = await pool.query("SELECT * FROM input_dfod WHERE id_input_dfod = ?", [id_input_dfod]);
    if (rows.length === 0) return res.status(404).json({ error: "Data not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching DFOD by ID:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const insertDFOD = async (req, res) => {
  try {
    const { nominal, jenis_pembayaran } = req.body;
    if (!jenis_pembayaran) return res.status(400).json({ error: "Jenis pembayaran wajib diisi" });

    const nominalParsed = parseNominal(nominal);
    const tanggal = formatTanggal();

    const [result] = await pool.query(
      "INSERT INTO input_dfod (tanggal_dfod, nominal, jenis_pembayaran) VALUES (?, ?, ?)",
      [tanggal, nominalParsed, jenis_pembayaran]
    );

    const id_input_dfod = result.insertId;
    const jenisTransaksi = mapJenisTransaksi(jenis_pembayaran);

    if (jenisTransaksi) {
      await pool.query(
        "INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, ?, ?)",
        [tanggal, jenisTransaksi, nominalParsed]
      );
      await pool.query(
        "INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, 'Saldo JFS', ?)",
        [tanggal, -nominalParsed]
      );
    }

    await pool.query("INSERT INTO log_input_dashboard (id_input_dfod) VALUES (?)", [id_input_dfod]);

    res.status(201).json({ message: "DFOD created successfully", id_input_dfod });
  } catch (err) {
    console.error("Error inserting DFOD:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const editDFOD = async (req, res) => {
  try {
    const { id_input_dfod, nominal, jenis_pembayaran } = req.body;
    if (!jenis_pembayaran) return res.status(400).json({ error: "Jenis pembayaran wajib diisi" });

    const nominalParsed = parseNominal(nominal);
    const tanggal = formatTanggal();

    const [[oldData]] = await pool.query("SELECT * FROM input_dfod WHERE id_input_dfod = ?", [id_input_dfod]);
    if (!oldData) return res.status(404).json({ error: "Data not found" });

    await pool.query(
      "UPDATE input_dfod SET nominal = ?, jenis_pembayaran = ?, tanggal_dfod = ? WHERE id_input_dfod = ?",
      [nominalParsed, jenis_pembayaran, tanggal, id_input_dfod]
    );

    const oldJenisTransaksi = mapJenisTransaksi(oldData.jenis_pembayaran);
    if (oldJenisTransaksi) {
      await pool.query(
        "DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = ? AND nominal = ?",
        [oldData.tanggal_dfod, oldJenisTransaksi, oldData.nominal]
      );
      await pool.query(
        "DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = 'Saldo JFS' AND nominal = ?",
        [oldData.tanggal_dfod, -oldData.nominal]
      );
    }

    const jenisTransaksi = mapJenisTransaksi(jenis_pembayaran);
    if (jenisTransaksi) {
      await pool.query(
        "INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, ?, ?)",
        [tanggal, jenisTransaksi, nominalParsed]
      );
      await pool.query(
        "INSERT INTO laporan_keuangan (tanggal, jenis_transaksi, nominal) VALUES (?, 'Saldo JFS', ?)",
        [tanggal, -nominalParsed]
      );
    }

    await pool.query("DELETE FROM log_input_dashboard WHERE id_input_dfod = ?", [id_input_dfod]);
    await pool.query("INSERT INTO log_input_dashboard (id_input_dfod) VALUES (?)", [id_input_dfod]);

    res.json({ message: "DFOD updated successfully" });
  } catch (err) {
    console.error("Error updating DFOD:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteDFOD = async (req, res) => {
  try {
    const { id_input_dfod } = req.body;
    const [[data]] = await pool.query("SELECT * FROM input_dfod WHERE id_input_dfod = ?", [id_input_dfod]);
    if (!data) return res.status(404).json({ error: "Data not found" });

    const jenisTransaksi = mapJenisTransaksi(data.jenis_pembayaran);

    await pool.query("DELETE FROM input_dfod WHERE id_input_dfod = ?", [id_input_dfod]);

    if (jenisTransaksi) {
      await pool.query(
        "DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = ? AND nominal = ?",
        [data.tanggal_dfod, jenisTransaksi, data.nominal]
      );
      await pool.query(
        "DELETE FROM laporan_keuangan WHERE tanggal = ? AND jenis_transaksi = 'Saldo JFS' AND nominal = ?",
        [data.tanggal_dfod, -data.nominal]
      );
    }

    await pool.query("DELETE FROM log_input_dashboard WHERE id_input_dfod = ?", [id_input_dfod]);

    res.json({ message: "DFOD deleted successfully" });
  } catch (err) {
    console.error("Error deleting DFOD:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
