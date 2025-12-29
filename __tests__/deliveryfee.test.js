// __tests__/deliveryfee.test.js
import { jest } from '@jest/globals'; 

// Import controller yang akan diuji
import { 
    getAllDeliveryFee, insertDeliveryFee, editDeliveryFee, 
    deleteDeliveryFee, getTrashDeliveryFee, restoreDeliveryFee, 
    deletePermanentDeliveryFee
} from "../controllers/input_deliveryfee.js";
import pool from "../config/dbconfig.js"; 

// ------------------------- MOCKING SETUP -------------------------

const mockRes = () => {
    const res = {};
    res.status = jest.fn(() => res); 
    res.json = jest.fn();
    return res;
};

const mockConnection = {
    query: jest.fn(),
    beginTransaction: jest.fn(() => Promise.resolve()),
    commit: jest.fn(() => Promise.resolve()),
    rollback: jest.fn(() => Promise.resolve()),
    release: jest.fn(),
};

// Mock global pool
pool.query = jest.fn();
pool.getConnection = jest.fn(() => Promise.resolve(mockConnection));

// Mock Tanggal (Agar hasil pengujian konsisten)
const FIXED_DATE = "2025-12-15";

// ------------------------- TEST SUITE -------------------------

describe('Delivery Fee System - Unit Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- 1. PENGUJIAN INSERT ---
    describe('insertDeliveryFee', () => {
        test('V1: Gagal jika nominal kurang dari 1.000', async () => {
            const req = { user: { role: 'Admin' }, body: { nominal: 500 } };
            const res = mockRes();
            await insertDeliveryFee(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Nominal minimal Rp 1.000" }));
        });

        test('T1: Sukses Insert (Data Utama, Laporan, dan Log)', async () => {
            const req = { user: { role: 'Admin' }, body: { nominal: 15000 } };
            const res = mockRes();

            mockConnection.query
                .mockResolvedValueOnce([{ insertId: 101 }]) // Insert DF
                .mockResolvedValueOnce([{}])                 // Insert Laporan
                .mockResolvedValueOnce([{}]);                // Insert Log

            await insertDeliveryFee(req, res);

            expect(mockConnection.beginTransaction).toHaveBeenCalled();
            expect(mockConnection.commit).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
        });
    });

    // --- 2. PENGUJIAN READ (GET) ---
    describe('getAllDeliveryFee', () => {
        test('A1: Super Admin dapat melihat semua data aktif', async () => {
            const req = { user: { roles: ['superadmin'] } };
            const res = mockRes();
            pool.query.mockResolvedValueOnce([[{ id: 1, nominal: 10000 }]]);

            await getAllDeliveryFee(req, res);
            expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("SELECT * FROM input_deliveryfee WHERE status = 'active'"));
            expect(res.json).toHaveBeenCalled();
        });

        test('A2: Admin hanya dapat melihat data hari ini', async () => {
            const req = { user: { roles: ['admin'] } };
            const res = mockRes();
            pool.query.mockResolvedValueOnce([[]]);

            await getAllDeliveryFee(req, res);
            expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("AND DATE(tanggal) = ?"), expect.anything());
        });
    });

    // --- 3. PENGUJIAN EDIT ---
    describe('editDeliveryFee', () => {
        test('E1: Gagal jika diakses oleh selain Super Admin', async () => {
            const req = { user: { role: 'Admin' }, body: { id_input_deliveryfee: 1, nominal: 20000 } };
            const res = mockRes();
            await editDeliveryFee(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        });

        test('E2: Sukses Edit nominal dan Laporan Keuangan', async () => {
            const req = { user: { role: 'Super Admin' }, body: { id_input_deliveryfee: 1, nominal: 25000 } };
            const res = mockRes();

            mockConnection.query
                .mockResolvedValueOnce([[{ tanggal: FIXED_DATE }]]) // SELECT data lama
                .mockResolvedValueOnce([{ affectedRows: 1 }])       // UPDATE DF
                .mockResolvedValueOnce([{}])                        // UPDATE Laporan
                .mockResolvedValueOnce([{}])                        // DELETE Log
                .mockResolvedValueOnce([{}]);                       // INSERT Log (Refresh)

            await editDeliveryFee(req, res);
            expect(mockConnection.commit).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    // --- 4. PENGUJIAN SOFT DELETE ---
    describe('deleteDeliveryFee', () => {
        test('D1: Berhasil Soft Delete dan Reverse Laporan Keuangan', async () => {
            const req = { user: { role: 'Super Admin' }, body: { id_input_deliveryfee: 1 } };
            const res = mockRes();

            mockConnection.query
                .mockResolvedValueOnce([[{ tanggal: FIXED_DATE, nominal: 15000 }]]) // SELECT
                .mockResolvedValueOnce([{}]) // UPDATE status deleted
                .mockResolvedValueOnce([{}]) // DELETE Laporan
                .mockResolvedValueOnce([{}]); // DELETE Log

            await deleteDeliveryFee(req, res);
            expect(mockConnection.commit).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    // --- 5. PENGUJIAN RESTORE ---
    describe('restoreDeliveryFee', () => {
        test('R1: Berhasil mengembalikan data dari Trash', async () => {
            const req = { user: { role: 'Super Admin' }, body: { id_input_deliveryfee: 1 } };
            const res = mockRes();

            mockConnection.query
                .mockResolvedValueOnce([[{ tanggal: FIXED_DATE, nominal: 15000 }]]) // SELECT deleted
                .mockResolvedValueOnce([{}]) // UPDATE status active
                .mockResolvedValueOnce([{}]) // INSERT Laporan
                .mockResolvedValueOnce([{}]); // INSERT Log

            await restoreDeliveryFee(req, res);
            expect(mockConnection.commit).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    // --- 6. PENGUJIAN PERMANENT DELETE ---
    describe('deletePermanentDeliveryFee', () => {
        test('P1: Berhasil hapus total dari database', async () => {
            const req = { user: { role: 'Super Admin' }, body: { id_input_deliveryfee: 1 } };
            const res = mockRes();

            mockConnection.query
                .mockResolvedValueOnce([[{ tanggal: FIXED_DATE, nominal: 15000 }]]) // SELECT
                .mockResolvedValueOnce([{}]) // DELETE DF
                .mockResolvedValueOnce([{}]) // DELETE Laporan
                .mockResolvedValueOnce([{}]); // DELETE Log

            await deletePermanentDeliveryFee(req, res);
            expect(mockConnection.commit).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

});