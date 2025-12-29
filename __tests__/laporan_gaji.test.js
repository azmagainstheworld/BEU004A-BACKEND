// __tests__/laporan_gaji.test.js

import { jest } from '@jest/globals'; 
import { getLaporanGaji } from "../controllers/laporan_gaji.js"; 
import pool from "../config/dbconfig.js"; 

// ------------------------- MOCKING SECTION -------------------------

// Simpan Date asli untuk digunakan kembali
const OriginalDate = global.Date;

const mockRes = () => {
    const res = {};
    res.status = jest.fn(() => res); 
    res.json = jest.fn();
    return res;
};

// MOCK Pool.query global
const mockQuery = jest.fn();
pool.query = mockQuery; 

// --- Data Dummy Mock (Simulasi Hasil DB) ---
const mockResultRow = {
    id_karyawan: 1,
    nama_karyawan: 'Karyawan Test',
    upah_perhari: 100000,
    bonus: 200000,
    total_presensi: 20,
    kasbon: 500000,
    gaji_kotor: 2200000, // (20 * 100.000) + 200.000
    gaji_bersih: 1700000, // 2.200.000 - 500.000
};

// ------------------------- TEST SUITES -------------------------

describe('Laporan Gaji Module - Unit Testing', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        global.Date = OriginalDate; // Reset Date sebelum setiap test
    });

    // --- 2. PENGUJIAN PERIODE SPESIFIK ---
    test('T2: Seharusnya menghitung periode berdasarkan input bulan (Contoh: 2025-05)', async () => {
        const res = mockRes();

        mockQuery.mockResolvedValueOnce([[{ '1': 1 }]]) 
                 .mockResolvedValueOnce([[mockResultRow]]); 

        const req = { user: { role: 'Super Admin' }, query: { bulan: '2025-05' } };
        await getLaporanGaji(req, res);

        const expectedStart = '2025-05-01';
        const expectedEnd = '2025-05-31'; 
        
        const queryParams = mockQuery.mock.calls[1][1];
        expect(queryParams[0]).toBe(expectedStart);
        expect(queryParams[1]).toBe(expectedEnd);
    });

    // --- 3. PENGUJIAN LOGIKA KALKULASI (WHITE BOX) ---
    test('V3: Pastikan Query SQL mengandung logika pengurangan Kasbon (Gaji Bersih)', async () => {
        const res = mockRes();
        mockQuery.mockResolvedValueOnce([[{ '1': 1 }]]) 
                 .mockResolvedValueOnce([[]]); 

        const req = { user: { role: 'Super Admin' }, query: {} };
        await getLaporanGaji(req, res);

        const sqlQuery = mockQuery.mock.calls[1][0];
        
        // Verifikasi keberadaan sub-query pengurangan nominal_pengeluaran
        expect(sqlQuery).toMatch(/SELECT IFNULL\(SUM\(ip2\.nominal_pengeluaran\)/);
        // Verifikasi filter status aktif pada kasbon agar data akurat
        expect(sqlQuery).toMatch(/ip2\.status = 'active'/);
    });

    // --- 4. PENGUJIAN HAK AKSES ---
    test('A1: Harus memblokir akses jika bukan Super Admin', async () => {
        const res = mockRes();
        const req = { user: { role: 'Admin' }, query: {} };

        await getLaporanGaji(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Forbidden: Akses hanya untuk Super Admin" }));
    });

    // --- 5. ERROR HANDLING ---
    test('E1: Mengembalikan 500 jika terjadi kegagalan koneksi/query DB', async () => {
        const res = mockRes();
        mockQuery.mockResolvedValueOnce([[{ '1': 1 }]]) 
                 .mockRejectedValueOnce(new Error("Database Crash")); 

        const req = { user: { role: 'Super Admin' }, query: {} };
        await getLaporanGaji(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: "Database Crash" }));
    });
});