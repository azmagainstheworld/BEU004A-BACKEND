// outgoing.test.js
import { jest } from '@jest/globals';
import { 
    getAllOutgoing, insertOutgoing, editOutgoing, 
    deleteOutgoing, restoreOutgoing, 
    deletePermanentOutgoing
} from "../controllers/input_outgoing.js"; 
import pool from "../config/dbconfig.js"; 

// ------------------------- MOCKING SECTION -------------------------

const mockRes = () => {
    const res = {};
    res.status = jest.fn(() => res); 
    res.json = jest.fn();
    return res;
};

// Mock Tanggal Tetap untuk Testing (WITA)
const mockTanggal = "2025-12-22"; 

// Mock DB Connection & Transaction
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

// Konstanta Perhitungan
const ID_TEST = 100;
const NOMINAL_BERSIH = 90000; // Contoh: 100.000 - 10.000
const POTONGAN_JFS = NOMINAL_BERSIH * 0.6; // 54.000 (60%)

// ------------------------- TEST SUITES -------------------------

describe('Outgoing Controller - Unit Testing (Logic & Transaction)', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- 1. TESTING READ (GET ALL) ---
    describe('getAllOutgoing', () => {
        test('W1: Admin harus difilter berdasarkan tanggal hari ini (WITA)', async () => {
            const res = mockRes();
            const req = { user: { roles: ['Admin'] } };
            mockQuery.mockResolvedValueOnce([[{ id: 1, nominal: 50000 }]]);

            await getAllOutgoing(req, res);

            // Verifikasi filter DATE(tanggal_outgoing) = ?
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining("AND DATE(tanggal_outgoing) = ?"),
                expect.arrayContaining([expect.any(String)]) // Memastikan ada parameter tanggal
            );
        });

        test('W2: Super Admin harus dapat melihat seluruh data tanpa filter tanggal', async () => {
            const res = mockRes();
            const req = { user: { roles: ['Super Admin'] } };
            mockQuery.mockResolvedValueOnce([[]]);

            await getAllOutgoing(req, res);

            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringMatching(/SELECT \* FROM input_outgoing WHERE status = 'active' ORDER BY/i)
            );
        });
    });

    // --- 2. TESTING INSERT ---
    describe('insertOutgoing', () => {
        test('W3: Harus menghitung potongan JFS 60% dan bernilai negatif di laporan', async () => {
            const res = mockRes();
            const req = { 
                user: { roles: ['Admin'] },
                body: { nominal: "100.000", potongan: "10.000", jenis_pembayaran: "Cash" } 
            };

            // Mocking sequence: 1. Insert Outgoing, 2. Kas, 3. Saldo JFS, 4. Log
            mockQuery.mockResolvedValueOnce([{ insertId: ID_TEST }])
                     .mockResolvedValueOnce([{}])
                     .mockResolvedValueOnce([{}])
                     .mockResolvedValueOnce([{}]);

            await insertOutgoing(req, res);

            // Verifikasi perhitungan JFS: 90.000 * 0.6 = 54.000 (disimpan negatif)
            expect(mockQuery).toHaveBeenNthCalledWith(3, 
                expect.stringContaining("'Saldo JFS'"),
                expect.arrayContaining([expect.any(String), -POTONGAN_JFS])
            );
            expect(mockConnection.commit).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id_input_outgoing: ID_TEST }));
        });

        test('W4: Gagal jika nominal bersih bernilai negatif', async () => {
            const res = mockRes();
            const req = { 
                user: { roles: ['Admin'] },
                body: { nominal: "10.000", potongan: "50.000", jenis_pembayaran: "Cash" } 
            };

            await insertOutgoing(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Nominal bersih tidak boleh negatif" }));
        });
    });


    // --- 4. TESTING DELETE & LIFECYCLE ---
    describe('deletePermanentOutgoing', () => {
        test('W5: Delete Permanen harus menghapus data dari tabel utama, laporan, dan log', async () => {
            const res = mockRes();
            const req = { user: { role: 'Super Admin' }, body: { id_input_outgoing: ID_TEST } };

            // Mock sequence: 1. SELECT, 2. DELETE Pemasukan, 3. DELETE JFS, 4. DELETE Log, 5. DELETE Main
            mockQuery.mockResolvedValueOnce([[{ id_input_outgoing: ID_TEST, nominal_bersih: 50000, jenis_pembayaran: 'Cash' }]])
                     .mockResolvedValue([{}]);

            await deletePermanentOutgoing(req, res);

            expect(mockQuery).toHaveBeenCalledTimes(5);
            expect(mockConnection.commit).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Outgoing permanently deleted" }));
        });
    });
});