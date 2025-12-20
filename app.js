import express from 'express';
import dotenv from 'dotenv';
import cors from "cors";
import pool from './config/dbconfig.js';
import usersRoute from './routes/usersRoute.js';
import authRoutes from "./routes/authRoutes.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    return res.json({
        msg: "Hello World",
        subject: "IPPL"
    });
});

app.use('/beu004a/users', usersRoute);
app.use('/beu004a/auth', authRoutes);

const PORT = process.env.PORT || 4000;
// Tambahkan route ini agar Railway tahu server hidup
app.get("/", (req, res) => {
  res.send("Backend J&T Cargo is Running!");
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//     console.log("Server is running on http://localhost:" + PORT);
// });