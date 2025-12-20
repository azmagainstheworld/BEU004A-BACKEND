// __tests__/laporan_keuangan.test.js

import { jest } from '@jest/globals'; 
import { getLaporanKeuangan } from "../controllers/laporan_keuangan.js"; 
import pool from "../config/dbconfig.js"; 

// ------------------------- MOCKING SECTION -------------------------

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

// Data Mock untuk Query 1 (Laporan Harian - rows)
const mockLaporanHarian = [
    { tanggal: '2025-12-15', Kas: 50000, Saldo_JFS: -10000, Transfer: 20000 },
    { tanggal: '2025-12-14', Kas: 10000, Saldo_JFS: -5000, Transfer: 5000 },
];

// Data Mock untuk Query 2 (Total Sekarang - totalNow)
const mockTotalSekarang = {
    kas: 60000,
    saldo_jfs: -15000, 
    transfer: 25000 
};


// ------------------------- GET LAPORAN KEUANGAN TESTS -------------------------

describe('Laporan Keuangan Controller', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockClear();
    });

    // T1: Sukses Mengambil Laporan (Query 1 dan Query 2)
    test('T1: Seharusnya berhasil mengambil Laporan Harian dan Total Saldo', async () => {
        const res = mockRes();
        
        // Mock Query 1: Laporan Harian (rows)
        // Mock Query 2: Total Sekarang (totalNow)
        mockQuery.mockResolvedValueOnce([mockLaporanHarian])
                 .mockResolvedValueOnce([[mockTotalSekarang]]); // Query 2 harus mengembalikan [[row]]

        const req = {};
        await getLaporanKeuangan(req, res);

        // Verifikasi Query 1 (Laporan Harian Group By)
        expect(mockQuery).toHaveBeenNthCalledWith(1, expect.stringContaining("GROUP BY DATE_FORMAT(tanggal, '%Y-%m-%d')"));
        
        // Verifikasi Query 2 (Total)
        expect(mockQuery).toHaveBeenNthCalledWith(2, expect.stringContaining("SUM(CASE WHEN jenis_transaksi = 'Kas'"));
        
        expect(mockQuery).toHaveBeenCalledTimes(2);
        expect(res.status).not.toHaveBeenCalledWith(500);
        
        // Verifikasi format output JSON
        expect(res.json).toHaveBeenCalledWith({
            laporan: mockLaporanHarian,
            total_sekarang: mockTotalSekarang
        });
    });

    // E1: Gagal Query Laporan Harian (Query 1 Gagal)
    test('E1: Seharusnya 500 jika Query Laporan Harian (Query 1) gagal', async () => {
        const res = mockRes();
        
        // Mock Query 1: Rejects
        mockQuery.mockRejectedValueOnce(new Error("Gagal ambil data harian")); 

        const req = {};
        await getLaporanKeuangan(req, res);

        expect(mockQuery).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Internal Server Error" }));
    });
    
    // E2: Gagal Query Total (Query 2 Gagal)
    test('E2: Seharusnya 500 jika Query Total (Query 2) gagal', async () => {
        const res = mockRes();
        
        // Mock Query 1: Laporan Harian (Sukses)
        mockQuery.mockResolvedValueOnce([mockLaporanHarian]);
        
        // Mock Query 2: Rejects
        mockQuery.mockRejectedValueOnce(new Error("Gagal hitung total")); 

        const req = {};
        await getLaporanKeuangan(req, res);

        expect(mockQuery).toHaveBeenCalledTimes(2);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Internal Server Error" }));
    });
    
    // V3: Query Structure Check (Query 1)
    test('V3: Query 1 harus menggunakan GROUP BY tanggal dan ORDER BY DESC', async () => {
        const res = mockRes();
        mockQuery.mockResolvedValueOnce([mockLaporanHarian])
                 .mockResolvedValueOnce([[mockTotalSekarang]]);

        const req = {};
        await getLaporanKeuangan(req, res);

        const query1 = mockQuery.mock.calls[0][0];

        // Memastikan penggunaan fungsi agregasi CASE WHEN
        expect(query1).toMatch(/SUM\(CASE WHEN jenis_transaksi = 'Kas' THEN nominal ELSE 0 END\)/);
        
        // Memastikan Grouping dan Ordering
        expect(query1).toMatch(/GROUP BY DATE_FORMAT\(tanggal, '%Y-%m-%d'\)/);
        expect(query1).toMatch(/ORDER BY tanggal DESC/);
    });
    
    // V4: Query Structure Check (Query 2)
    test('V4: Query 2 harus menghitung Total Saldo JFS secara global', async () => {
        const res = mockRes();
        mockQuery.mockResolvedValueOnce([mockLaporanHarian])
                 .mockResolvedValueOnce([[mockTotalSekarang]]);

        const req = {};
        await getLaporanKeuangan(req, res);

        const query2 = mockQuery.mock.calls[1][0];

        // Memastikan tidak ada GROUP BY
        expect(query2).not.toMatch(/GROUP BY/);
        
        // Memastikan perhitungan Saldo JFS
        expect(query2).toMatch(/SUM\(CASE WHEN jenis_transaksi = 'Saldo JFS' THEN nominal ELSE 0 END\) AS saldo_jfs/);
        
        // Memastikan hanya mengambil dari tabel laporan_keuangan
        expect(query2).toMatch(/FROM laporan_keuangan/);
    });
});