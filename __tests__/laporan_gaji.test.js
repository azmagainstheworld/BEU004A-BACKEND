// __tests__/laporan_gaji.test.js

import { jest } from '@jest/globals'; 
import { getLaporanGaji } from "../controllers/laporan_gaji.js"; 
import pool from "../config/dbconfig.js"; 

// ------------------------- MOCKING SECTION -------------------------

// Simpan Date asli
const OriginalDate = global.Date;

// MOCK res
const mockRes = () => {
    const res = {};
    res.status = jest.fn(() => res); 
    res.json = jest.fn();
    return res;
};

// MOCK Pool.query
const mockQuery = jest.fn();
pool.query = mockQuery; 

// --- Data Mock ---
const idKaryawan = 1;
const upahPerhari = 100000;
const bonus = 200000;
const totalPresensi = 20;
const totalKasbon = 500000;

const mockResultRow = {
    id_karyawan: idKaryawan,
    nama_karyawan: 'Karyawan Test',
    upah_perhari: upahPerhari,
    bonus: bonus,
    total_presensi: totalPresensi,
    kasbon: totalKasbon,
    gaji_kotor: 2200000,
    gaji_bersih: 1700000,
};

// ------------------------- LAPORAN GAJI TESTS -------------------------

describe('Laporan Gaji Controller', () => {
    
    beforeEach(() => {
        // Reset mocks dan kembalikan Date ke aslinya sebelum setiap test
        jest.clearAllMocks();
        mockQuery.mockClear();
        global.Date = OriginalDate; // Penting untuk isolasi T2
    });

    // T1: Sukses Mengambil Laporan (Bulan Saat Ini) - SINKRONISASI KE TANGGAL HARI INI
    test('T1: Seharusnya menghitung laporan gaji untuk bulan saat ini (sampai hari ini)', async () => {
        const res = mockRes();

        // 1. Mock Date saat ini untuk T1 (2025-12-15)
        const mockDateT1 = new OriginalDate(2025, 11, 15); // Month index 11 = December
        global.Date = jest.fn(() => mockDateT1); 

        // Mock Query 1: Ping DB
        // Mock Query 2: Laporan Gaji
        mockQuery.mockResolvedValueOnce([[{ '1': 1 }]]) 
                 .mockResolvedValueOnce([[mockResultRow]]); 

        const req = { query: {} }; // Tanpa query string 'bulan'
        await getLaporanGaji(req, res);

        // Berdasarkan perilaku Controller: Periode yang diambil HANYA sampai tanggal hari ini.
        const expectedStart = '2025-12-01';
        const expectedEnd = '2025-12-15'; 
        
        // Cek Parameter Query (5 pasang start/end date = 10 parameter)
        const queryParams = mockQuery.mock.calls[1][1];
        expect(queryParams.length).toBe(10);
        
        // Assertion T1
        const expectedParams = [
            expectedStart, expectedEnd, expectedStart, expectedEnd, expectedStart, expectedEnd, 
            expectedStart, expectedEnd, expectedStart, expectedEnd
        ];
        expect(queryParams).toEqual(expectedParams); 

        // Verifikasi Hasil
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        expect(res.status).not.toHaveBeenCalledWith(500);
    });

    // T2: Sukses Mengambil Laporan (Bulan Spesifik) - FIX ISOLASI MOCK TANGGAL
    test('T2: Seharusnya menghitung laporan gaji untuk bulan spesifik (2025-05)', async () => {
        const res = mockRes();

        // Karena T2 menggunakan req.query.bulan, kita harus memastikan
        // new Date(bulan + "-01") berjalan normal. Date sudah direset di beforeEach.

        // Mock Query 1: Ping DB
        // Mock Query 2: Laporan Gaji
        mockQuery.mockResolvedValueOnce([[{ '1': 1 }]]) 
                 .mockResolvedValueOnce([[mockResultRow]]); 

        const req = { query: { bulan: '2025-05' } };
        await getLaporanGaji(req, res);

        // Verifikasi Tanggal (Harusnya 2025-05-01 sampai 2025-05-31)
        const expectedStart = '2025-05-01';
        const expectedEnd = '2025-05-31'; 
        
        // Cek Parameter Query
        const queryParams = mockQuery.mock.calls[1][1];
        expect(queryParams.length).toBe(10);
        expect(queryParams[0]).toBe(expectedStart);
        expect(queryParams[1]).toBe(expectedEnd); // Cek tanggal akhir bulan

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
    
    // V3: Query harus memiliki logika kalkulasi Gaji Bersih = Gaji Kotor - Kasbon
    test('V3: Query harus memiliki logika kalkulasi Gaji Bersih = Gaji Kotor - Kasbon', async () => {
        const res = mockRes();
        
        // Mock Query 1: Ping DB
        // Mock Query 2: Laporan Gaji (tanpa data)
        mockQuery.mockResolvedValueOnce([[{ '1': 1 }]]) 
                 .mockResolvedValueOnce([[]]); 

        const req = { query: {} };
        await getLaporanGaji(req, res);

        const sqlQuery = mockQuery.mock.calls[1][0];
        
        // Cek bahwa bagian pengurangan Kasbon ada
        expect(sqlQuery).toMatch(/SELECT IFNULL\(SUM\(ip2\.nominal_pengeluaran\)/);
    });
    
    // E4: Error Database
    test('E4: Seharusnya mengembalikan 500 jika query Gaji gagal', async () => {
        const res = mockRes();

        // Mock Query 1: Ping DB
        // Mock Query 2: Laporan Gaji (GAGAL)
        mockQuery.mockResolvedValueOnce([[{ '1': 1 }]]) 
                 .mockRejectedValueOnce(new Error("SQL Error: JOIN failed")); 

        const req = { query: {} };
        await getLaporanGaji(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
            success: false,
            error: "SQL Error: JOIN failed" 
        }));
    });
});