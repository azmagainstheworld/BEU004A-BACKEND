import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: false 
  }
});

// Tambahkan ini di bawah kode createPool kamu
const testQuery = async () => {
  try {
    const [rows] = await pool.query("SELECT 1 + 1 AS hasil");
    console.log("✅ Koneksi TiDB Cloud Stabil. Test Query Berhasil, Hasil:", rows[0].hasil);
  } catch (err) {
    console.error("❌ Koneksi terdeteksi tapi gagal query:", err.message);
  }
};

testQuery();
// try {
//   const connection = await pool.getConnection();
//   console.log(`Connected to database: ${process.env.DB_NAME}`);
//   connection.release(); 
  
// } catch (error) {
//   console.error("Error connecting to the database:", error.message);
// }

export default pool;
