import { jest } from '@jest/globals';
import { 
    getAllOutgoing, insertOutgoing, editOutgoing, 
    deleteOutgoing, restoreOutgoing, 
    deletePermanentOutgoing
} from "../controllers/input_outgoing.js"; 
import pool from "../config/dbconfig.js"; 

// ------------------------- MOCKING SECTION -------------------------

// Mock Response object
const mockRes = () => {
    const res = {};
    res.status = jest.fn(() => res); 
    res.json = jest.fn();
    return res;
};

// Mock Date untuk mengunci waktu testing (22 Desember 2025 WITA)
const mockTanggal = "2025-12-22"; 

// Mocking global Date object agar menghasilkan tanggal yang konsisten
global.Date = class MockDate extends Date {
    constructor() { super(mockTanggal); }
    toLocaleDateString(locale, options) {
        if (options?.timeZone === "Asia/Makassar") return mockTanggal;
        return super.toLocaleDateString(locale, options);
    }
};

// Mock DB Connection untuk Transaction
const mockQuery = jest.fn();
const mockConnection = {
    query: mockQuery,
    beginTransaction: jest.fn(() => Promise.resolve()),
    commit: jest.fn(() => Promise.resolve()),
    rollback: jest.fn(() => Promise.resolve()),
    release: jest.fn(),
};

pool.query = mockQuery; 
pool.getConnection = jest.fn(() => Promise.resolve(mockConnection)); 

// Global Data untuk Test
const idToProcess = 100;
const nominalBersih = 90000;
const potonganJFS = nominalBersih * 0.6; // 54000

// ------------------------- TEST SUITES -------------------------

describe('Outgoing White-Box Testing (Sync Time Logic)', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Test 1: Logika Filter Tanggal Admin (Kritis)
    test('W1: Admin seharusnya difilter menggunakan todayStr (Asia/Makassar) bukan CURDATE()', async () => {
        const res = mockRes();
        const req = { user: { roles: ['Admin'] } };

        // Mock return data
        mockQuery.mockResolvedValueOnce([[{ id: 1, nominal: 50000 }]]);

        await getAllOutgoing(req, res);

        // Verifikasi apakah query menggunakan parameter tanggal yang benar (?) dan todayStr
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining("AND DATE(tanggal_outgoing) = ?"),
            expect.arrayContaining([mockTanggal])
        );
    });

    // Test 2: Logika Insert dengan Potongan JFS
    test('W2: Insert Outgoing harus menghitung 60% potongan JFS dan bernilai negatif di laporan', async () => {
        const res = mockRes();
        const req = { 
            body: { nominal: "100.000", potongan: "10.000", jenis_pembayaran: "Cash" } 
        };

        // Mocking: 1. Insert Outgoing, 2. Insert Laporan Kas, 3. Insert Saldo JFS, 4. Insert Log
        mockQuery.mockResolvedValueOnce([{ insertId: idToProcess }])
                 .mockResolvedValueOnce([{}])
                 .mockResolvedValueOnce([{}])
                 .mockResolvedValueOnce([{}]);

        await insertOutgoing(req, res);

        // Verifikasi Query ke-3 (Insert Saldo JFS)
        // Nominal bersih 90.000, 60% nya adalah 54.000, harus masuk sebagai -54000
        expect(mockQuery).toHaveBeenNthCalledWith(3, 
            expect.stringContaining("'Saldo JFS'"),
            expect.arrayContaining([mockTanggal, -potonganJFS])
        );
        expect(mockConnection.commit).toHaveBeenCalled();
    });

    // Test 3: Logika Edit (Reverse Transaksi)
    test('W3: Edit Outgoing harus menggunakan tanggal_outgoing asli dari data lama', async () => {
        const res = mockRes();
        const tanggalLama = "2025-12-10";
        const req = { 
            body: { id_input_outgoing: idToProcess, nominal: "50000", jenis_pembayaran: "Transfer" } 
        };

        // Mock: 1. Ambil data lama (SELECT)
        mockQuery.mockResolvedValueOnce([[{ 
            id_input_outgoing: idToProcess, 
            tanggal_outgoing: tanggalLama, 
            nominal_bersih: 40000,
            jenis_pembayaran: 'Cash'
        }]]);
        
        // Mock query sisa (Update, Delete lama, Insert baru, dll)
        for(let i=0; i<7; i++) mockQuery.mockResolvedValueOnce([{}]);

        await editOutgoing(req, res);

        // Verifikasi Update menggunakan tanggalLama, bukan mockTanggal (hari ini)
        expect(mockQuery).toHaveBeenNthCalledWith(2,
            expect.stringContaining("UPDATE input_outgoing"),
            expect.arrayContaining([tanggalLama])
        );
    });

    // Test 4: Logika Delete Permanen (Integritas Data)
    test('W4: Delete Permanen harus menghapus data dari 4 tabel terkait', async () => {
        const res = mockRes();
        const req = { body: { id_input_outgoing: idToProcess } };

        // Mock: 1. SELECT, 2. DELETE Kas, 3. DELETE JFS, 4. DELETE Log, 5. DELETE Main
        mockQuery.mockResolvedValueOnce([[{ id_input_outgoing: idToProcess, jenis_pembayaran: 'Cash' }]])
                 .mockResolvedValueOnce([{}])
                 .mockResolvedValueOnce([{}])
                 .mockResolvedValueOnce([{}])
                 .mockResolvedValueOnce([{}]);

        await deletePermanentOutgoing(req, res);

        expect(mockQuery).toHaveBeenCalledTimes(5);
        expect(mockConnection.commit).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Outgoing permanently deleted" }));
    });
});