// __tests__/manajemen_gaji.test.js

import { jest } from '@jest/globals'; 
import { 
    getAllManajemenGaji, saveManajemenGaji, getManajemenGajiById 
} from "../controllers/manajemen_gaji.js"; 
import pool from "../config/dbconfig.js"; 

// ------------------------- MOCKING SECTION -------------------------

const mockRes = () => {
    const res = {};
    res.status = jest.fn(() => res); 
    res.json = jest.fn();
    return res;
};

// Mock Pool.query global agar tidak menyentuh database asli
const mockQuery = jest.fn();
pool.query = mockQuery; 

// Data Mocking
const idKaryawan = 15;
const upahPerhari = 100000;
const bonus = 500000;

const mockGajiData = {
    id_karyawan: idKaryawan,
    nama_karyawan: 'Dewi Lestari',
    upah_perhari: upahPerhari,
    bonus: bonus
};

// ------------------------- TEST SUITES -------------------------

describe('Manajemen Gaji Module - Unit Testing', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Menutup koneksi database untuk mencegah error "environment torn down"
    afterAll(async () => {
        try { if (pool.end) await pool.end(); } catch (e) {}
    });

    // --- 1. PENGUJIAN READ (GET ALL) ---
    describe('Read Controllers', () => {
        test('R1: GetAll - Harus mengambil data dengan LEFT JOIN karyawan (Super Admin Only)', async () => {
            const res = mockRes();
            const req = { user: { role: 'Super Admin' } };
            mockQuery.mockResolvedValueOnce([[mockGajiData]]);
            
            await getAllManajemenGaji(req, res);
            
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN manajemen_gaji mg'));
            expect(res.json).toHaveBeenCalled();
        });

        test('A1: GetAll - Harus memblokir akses jika bukan Super Admin', async () => {
            const res = mockRes();
            const req = { user: { role: 'Admin' } };
            await getAllManajemenGaji(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        });

        test('R2: GetByID - Harus mengambil data berdasarkan id_karyawan (Body)', async () => {
            const res = mockRes();
            const req = { body: { id_karyawan: idKaryawan } };
            mockQuery.mockResolvedValueOnce([[mockGajiData]]);
            
            await getManajemenGajiById(req, res);
            
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("WHERE mg.id_karyawan = ?"), [idKaryawan]);
            expect(res.json).toHaveBeenCalledWith(mockGajiData);
        });
    });

    // --- 2. PENGUJIAN SAVE/UPDATE (UPSERT) ---
    describe('Save/Update Controller', () => {
        test('T1: Sukses Simpan Data (Insert Baru/Update jika sudah ada)', async () => {
            const res = mockRes();
            const req = { 
                user: { role: 'Super Admin' },
                body: { id_karyawan: idKaryawan, upah_perhari: upahPerhari, bonus: 200000 } 
            };
            mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]); 

            await saveManajemenGaji(req, res);
            
            // Verifikasi penggunaan ON DUPLICATE KEY UPDATE
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining("ON DUPLICATE KEY UPDATE"),
                expect.arrayContaining([idKaryawan, upahPerhari, 200000])
            );
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Data manajemen gaji berhasil disimpan" }));
        });

        test('V1: Gagal jika id_karyawan atau upah_perhari kosong', async () => {
            const res = mockRes();
            const req = { user: { role: 'Super Admin' }, body: { id_karyawan: idKaryawan } }; // upah_perhari kosong
            await saveManajemenGaji(req, res);
            
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "id_karyawan dan upah_perhari wajib diisi" }));
        });
    });

    // --- 3. ERROR HANDLING ---
    describe('Error Handling', () => {
        test('E1: Mengembalikan 500 jika terjadi kegagalan query database', async () => {
            const res = mockRes();
            const req = { user: { role: 'Super Admin' }, body: { id_karyawan: idKaryawan, upah_perhari: 1000 } };
            mockQuery.mockRejectedValueOnce(new Error("Database Crash"));

            await saveManajemenGaji(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Internal Server Error" }));
        });
    });
});