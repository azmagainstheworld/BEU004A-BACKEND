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

app.use('/beu004a/users', usersRoute);
app.use('/beu004a/auth', authRoutes);

// Route utama untuk Health Check
app.get('/', (req, res) => {
    return res.json({
        msg: "Backend J&T Cargo is Running",
        status: "Online"
    });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});