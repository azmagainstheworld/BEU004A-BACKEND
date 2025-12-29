// __tests__/laporan_keuangan.test.js

import { jest } from '@jest/globals'; 
import { getLaporanKeuangan } from "../controllers/laporan_keuangan.js"; 
import pool from "../config/dbconfig.js"; 

// ------------------------- MOCKING SECTION -------------------------

const mockRes = () => {
    const res = {};
    res.status = jest.fn(() => res); 
    res.json = jest.fn();
    return res;
};

// MOCK Pool.query global agar pengujian tidak menyentuh database asli
const mockQuery = jest.fn();
pool.query = mockQuery; 

// Data Mock untuk Hasil Query
const mockLaporanHarian = [
    { tanggal_bersih: '2025-12-15', Kas: 50000, Saldo_JFS: -10000, Transfer: 20000 },
    { tanggal_bersih: '2025-12-14', Kas: 10000, Saldo_JFS: -5000, Transfer: 5000 },
];

const mockTotalSekarang = {
    kas: 60000,
    saldo_jfs: -15000, 
    transfer: 25000 
};

// ------------------------- TEST SUITES -------------------------

describe('Laporan Keuangan Module - Unit Testing', () => {
    
    // Membersihkan mock sebelum setiap pengujian
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Menutup koneksi database untuk mencegah error "environment torn down"
    afterAll(async () => {
        if (pool.end) await pool.end();
    });

    // --- 1. PENGUJIAN HAK AKSES (Authorization) ---
    test('A1: Harus memblokir akses jika user tidak memiliki role Admin atau Super Admin', async () => {
        const res = mockRes();
        const req = { user: { roles: ['User Biasa'] } };

        await getLaporanKeuangan(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
            error: "Akses ditolak: Hanya Admin dan Super Admin yang diizinkan" 
        }));
    });

    // --- 2. PENGUJIAN SUKSES (Super Admin / Admin) ---
    test('T1: Seharusnya berhasil mengambil Laporan Harian dan Total Saldo Global', async () => {
        const res = mockRes();
        const req = { user: { roles: ['Super Admin'] } };
        
        // Mock Query 1: Laporan Harian
        // Mock Query 2: Total Keseluruhan
        mockQuery.mockResolvedValueOnce([mockLaporanHarian])
                 .mockResolvedValueOnce([[mockTotalSekarang]]); 

        await getLaporanKeuangan(req, res);

        expect(mockQuery).toHaveBeenCalledTimes(2);
        expect(res.json).toHaveBeenCalledWith({
            laporan: mockLaporanHarian,
            total_sekarang: mockTotalSekarang
        });
    });

    // --- 3. PENGUJIAN STRUKTUR QUERY (White Box) ---
    test('V1: Verifikasi struktur SQL mengandung GROUP BY dan CASE WHEN untuk agregasi', async () => {
        const res = mockRes();
        const req = { user: { roles: ['Admin'] } };
        mockQuery.mockResolvedValueOnce([mockLaporanHarian])
                 .mockResolvedValueOnce([[mockTotalSekarang]]);

        await getLaporanKeuangan(req, res);

        const sqlDailyQuery = mockQuery.mock.calls[0][0];
        
        // Pastikan ada pengelompokan berdasarkan tanggal
        expect(sqlDailyQuery).toMatch(/GROUP BY tanggal_bersih/i);
        // Pastikan ada logika pemilahan jenis transaksi
        expect(sqlDailyQuery).toMatch(/SUM\(CASE WHEN jenis_transaksi = 'Kas' THEN nominal ELSE 0 END\)/i);
        // Pastikan urutan terbaru di atas
        expect(sqlDailyQuery).toMatch(/ORDER BY tanggal_bersih DESC/i);
    });

    // --- 4. PENGUJIAN ERROR HANDLING ---
    test('E1: Mengembalikan status 500 jika terjadi kegagalan pada database', async () => {
        const res = mockRes();
        const req = { user: { roles: ['Super Admin'] } };
        
        // Simulasi error saat query pertama
        mockQuery.mockRejectedValueOnce(new Error("Database Timeout")); 

        await getLaporanKeuangan(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
            error: "Internal Server Error" 
        }));
    });
});