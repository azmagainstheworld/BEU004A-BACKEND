// __tests__/pengeluaran.test.js
import { jest } from '@jest/globals';

// Import controller yang akan diuji
import { 
    parseNominal, formatTanggal, insertPengeluaran, getAllPengeluaran,
    editPengeluaran, deletePengeluaran, restorePengeluaran, 
    deletePermanentPengeluaran, getTrashPengeluaran 
} from "../controllers/input_pengeluaran.js";
import pool from "../config/dbconfig.js";

// ------------------------- MOCKING SECTION -------------------------

const mockRes = () => {
    const res = {};
    res.status = jest.fn(() => res); 
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

// Mock Koneksi Transaksi Database
const mockQuery = jest.fn();
const mockConnection = {
    query: mockQuery,
    beginTransaction: jest.fn(() => Promise.resolve()),
    commit: jest.fn(() => Promise.resolve()),
    rollback: jest.fn(() => Promise.resolve()),
    release: jest.fn(),
};

// Pasang mock ke pool global
pool.query = mockQuery; 
pool.getConnection = jest.fn(() => Promise.resolve(mockConnection));

// Mock Tanggal Tetap (WITA) agar pengujian konsisten
const FIXED_DATE = "2025-12-15";

// ------------------------- TEST SUITES -------------------------

describe('Pengeluaran Controller - Unit Testing', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        try { if (pool.end) await pool.end(); } catch (e) {}
    });

    // --- 1. PENGUJIAN UTILITY ---
    describe('Utility Functions', () => {
        test('U1: parseNominal harus membersihkan format titik Rupiah', () => {
            expect(parseNominal("25.500")).toBe(25500);
        });

        test('U2: parseNominal harus melempar error jika di bawah 1.000', () => {
            expect(() => parseNominal("500")).toThrow("Nominal minimal 1.000");
        });
    });

    // --- 2. PENGUJIAN AKSES (READ) ---
    describe('getAllPengeluaran', () => {
        test('A1: Super Admin dapat melihat semua pengeluaran aktif', async () => {
            const req = { user: { roles: ['Super Admin'] } };
            const res = mockRes();
            mockQuery.mockResolvedValueOnce([[{ id_input_pengeluaran: 1 }]]);

            await getAllPengeluaran(req, res);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("WHERE p.status = 'active'"));
            expect(res.json).toHaveBeenCalled();
        });

        test('A2: Admin hanya dapat melihat pengeluaran hari ini', async () => {
            const req = { user: { roles: ['Admin'] } };
            const res = mockRes();
            mockQuery.mockResolvedValueOnce([[]]);

            await getAllPengeluaran(req, res);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("AND DATE(p.tanggal_pengeluaran) = ?"), expect.anything());
        });
    });

    // --- 3. PENGUJIAN INSERT (TRANSAKSI) ---
    describe('insertPengeluaran', () => {
        test('I1: Berhasil Insert Pengeluaran Operasional (Kas)', async () => {
            const req = { 
                user: { roles: ['Admin'] },
                body: { nominal_pengeluaran: "15.000", jenis_pengeluaran: "Operasional", jenis_pembayaran: "Cash", deskripsi: "Parkir" } 
            };
            const res = mockRes();

            mockConnection.query
                .mockResolvedValueOnce([{ insertId: 101 }]) // Insert data utama
                .mockResolvedValueOnce([{}])                // Laporan Kas (Negatif)
                .mockResolvedValueOnce([{}]);               // Log Dashboard

            await insertPengeluaran(req, res);
            expect(mockConnection.commit).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
        });

        test('I2: Berhasil Insert Top Up Saldo JFS (Double Entry)', async () => {
            const req = { 
                user: { roles: ['Admin'] },
                body: { nominal_pengeluaran: "100.000", jenis_pengeluaran: "Top Up Saldo JFS", jenis_pembayaran: "Transfer" } 
            };
            const res = mockRes();

            mockConnection.query
                .mockResolvedValueOnce([{ insertId: 102 }]) // Main
                .mockResolvedValueOnce([{}])                // Laporan: Saldo JFS (+)
                .mockResolvedValueOnce([{}])                // Laporan: Transfer (-)
                .mockResolvedValueOnce([{}]);               // Log

            await insertPengeluaran(req, res);
            // Cek apakah nominal JFS positif
            expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining("'Saldo JFS'"), expect.arrayContaining([expect.anything(), 100000]));
            expect(mockConnection.commit).toHaveBeenCalled();
        });

        test('V1: Gagal jika Kasbon tapi Nama Karyawan kosong', async () => {
            const req = { 
                user: { roles: ['Admin'] },
                body: { nominal_pengeluaran: "50.000", jenis_pengeluaran: "Kasbon", jenis_pembayaran: "Cash" } 
            };
            const res = mockRes();
            await insertPengeluaran(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Nama karyawan wajib diisi untuk Kasbon" }));
        });
    });

    // --- 4. PENGUJIAN EDIT (REVERSE LOGIC) ---
    describe('editPengeluaran', () => {
        test('E1: Berhasil Update dengan membatalkan laporan lama dan membuat laporan baru', async () => {
            const req = { 
                user: { role: 'Super Admin' },
                body: { id_pengeluaran: 1, nominal_pengeluaran: "20.000", jenis_pengeluaran: "Operasional", jenis_pembayaran: "Transfer", deskripsi: "Update" } 
            };
            const res = mockRes();

            mockConnection.query
                .mockResolvedValueOnce([[{ id_input_pengeluaran: 1, nominal_pengeluaran: 10000, jenis_pembayaran: "Cash", tanggal_pengeluaran: FIXED_DATE }]]) // SELECT OLD
                .mockResolvedValue([{}]); // Mock sisa query UPDATE, DELETE, INSERT, LOG

            await editPengeluaran(req, res);
            expect(mockConnection.beginTransaction).toHaveBeenCalled();
            expect(mockConnection.commit).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Pengeluaran berhasil diupdate" }));
        });
    });

    // --- 5. LIFECYCLE (SOFT DELETE & RESTORE) ---
    describe('Lifecycle Controllers', () => {
        test('D1: Soft Delete harus membatalkan saldo di Laporan Keuangan', async () => {
            const req = { user: { role: 'Super Admin' }, body: { id_pengeluaran: 1 } };
            const res = mockRes();

            mockConnection.query
                .mockResolvedValueOnce([[{ id_input_pengeluaran: 1, nominal_pengeluaran: 10000, jenis_pembayaran: "Cash", tanggal_pengeluaran: FIXED_DATE }]]) // SELECT
                .mockResolvedValue([{}]); // UPDATE & DELETE FINANCE LOGS

            await deletePengeluaran(req, res);
            expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM laporan_keuangan"), expect.anything());
            expect(mockConnection.commit).toHaveBeenCalled();
        });

        test('R1: Restore harus mengembalikan status aktif dan mengisi kembali Laporan Keuangan', async () => {
            const req = { user: { role: 'Super Admin' }, body: { id_input_pengeluaran: 1 } };
            const res = mockRes();

            mockConnection.query
                .mockResolvedValueOnce([[{ id_input_pengeluaran: 1, nominal_pengeluaran: 10000, jenis_pembayaran: "Cash", tanggal_pengeluaran: FIXED_DATE }]]) // SELECT deleted
                .mockResolvedValue([{}]); // UPDATE & INSERT FINANCE LOGS

            await restorePengeluaran(req, res);
            expect(mockConnection.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO laporan_keuangan"), expect.anything());
            expect(mockConnection.commit).toHaveBeenCalled();
        });
    });
});