// __tests__/deliveryfee.test.js (KODE FINAL PURE JS SYNC)

import { jest } from '@jest/globals'; 

import { 
    getAllDeliveryFee, insertDeliveryFee, editDeliveryFee, 
    deleteDeliveryFee, getTrashDeliveryFee, restoreDeliveryFee, 
    deletePermanentDeliveryFee
} from "../controllers/input_deliveryfee.js";
import pool from "../config/dbconfig.js"; 

// ------------------------- MOCKING SECTION -------------------------

// MOCK res
const mockRes = () => {
    const res = {};
    res.status = jest.fn(() => res); 
    res.json = jest.fn();
    return res;
};

// MOCK Date
const mockTanggal = "2025-12-15"; 
const mockTanggalLama = "2025-12-14"; 

global.Date = class MockDate extends Date {
    constructor() { super(mockTanggal); }
    getFullYear() { return 2025; }
    getMonth() { return 11; } 
    getDate() { return 15; }
    getHours() { return 10; } 
    getMinutes() { return 30; }
    getSeconds() { return 0; }
};

// MOCK Pool & Connection (UNTUK TRANSACTION HANDLING)
const mockQuery = jest.fn();
const mockConnection = {
    query: mockQuery,
    beginTransaction: jest.fn(() => Promise.resolve()),
    commit: jest.fn(() => Promise.resolve()),
    rollback: jest.fn(() => Promise.resolve()),
    release: jest.fn(),
};

// Setup mock untuk semua interaksi DB
pool.query = mockQuery; 
pool.getConnection = jest.fn(() => Promise.resolve(mockConnection)); 

// Data Umum
const idToProcess = 70;
const nominalToProcess = 15000;
const oldData = {
    tanggal: mockTanggalLama, nominal: nominalToProcess,
    id_input_deliveryfee: idToProcess, status: 'active'
};
const deletedData = { ...oldData, status: 'deleted' };
const bodyUpdate = { id_input_deliveryfee: idToProcess, nominal: 25000 };


// ------------------------- UTILITY & INSERT TESTS -------------------------

describe('Delivery Fee Insert Controller', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        mockConnection.commit.mockClear();
        mockConnection.rollback.mockClear();
        mockQuery.mockClear();
    });
    
    // V1: Validasi Nominal
    test('V1: Seharusnya 400 jika nominal < 1000', async () => {
        const res = mockRes();
        const req = { body: { nominal: "500" } };
        await insertDeliveryFee(req, res);
        
        expect(mockQuery).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    // T1: Sukses Insert
    test('T1: Seharusnya berhasil INSERT Delivery Fee, Laporan, dan Log', async () => {
        const res = mockRes();
        // Mock DB: 1. Insert DF 2. Insert Laporan 3. Insert Log
        mockQuery.mockResolvedValueOnce([{ insertId: idToProcess }])
                 .mockResolvedValueOnce([{}])
                 .mockResolvedValueOnce([{}]);
        
        const req = { body: { nominal: nominalToProcess } };
        await insertDeliveryFee(req, res);

        // Verifikasi Query ke-2 (Insert Laporan Keuangan)
        expect(mockQuery).toHaveBeenNthCalledWith(2, 
            expect.stringContaining("INSERT INTO laporan_keuangan"),
            expect.arrayContaining([mockTanggal, nominalToProcess]) 
        );

        expect(mockQuery).toHaveBeenCalledTimes(3); 
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(201);
    });

    // E1: Gagal Insert Laporan Keuangan (Simulasi Rollback)
    test('E1: Seharusnya ROLLBACK dan mengembalikan 500 jika gagal INSERT Laporan Keuangan', async () => {
        const res = mockRes();
        // Mock DB: 1. Insert DF (Sukses) 2. Insert Laporan (Gagal - memicu catch)
        mockQuery.mockResolvedValueOnce([{ insertId: idToProcess }])
                 .mockRejectedValueOnce(new Error("DB error")); 
        
        const req = { body: { nominal: nominalToProcess } };
        await insertDeliveryFee(req, res);

        expect(mockQuery).toHaveBeenCalledTimes(2); 
        expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ------------------------- READ, EDIT & LIFECYCLE TESTS -------------------------

describe('Delivery Fee Read, Edit, and Lifecycle Controllers', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        mockConnection.commit.mockClear();
        mockConnection.rollback.mockClear();
        mockQuery.mockClear();
    });

    // A1: Super Admin (GetAll)
    test('A1: Seharusnya mengambil semua data aktif jika Super Admin', async () => {
        const res = mockRes();
        // Menggunakan pool.query (non-transactional read)
        pool.query.mockResolvedValueOnce([[{ id: 1, nominal: 10000 }]]);
        const req = { user: { roles: ['Super Admin'] } };
        await getAllDeliveryFee(req, res);
        expect(pool.query).toHaveBeenCalledTimes(1); // Perhatikan: Menggunakan pool.query
    });
    
    // E2: Edit - Nominal Invalid
    test('E2: Seharusnya 400 jika nominal edit tidak valid', async () => {
        const res = mockRes();
        const req = { body: { id_input_deliveryfee: idToProcess, nominal: "0" } };
        await editDeliveryFee(req, res);
        
        expect(mockQuery).not.toHaveBeenCalled(); 
        expect(res.status).toHaveBeenCalledWith(400);
    });

    // E3: Edit - Data Not Found (FIXED: Call Count 1)
    test('E3: Seharusnya 404 jika data edit tidak ditemukan (SELECT/UPDATE gagal)', async () => {
        const res = mockRes();
        // Mock DB: 1. SELECT (kosong)
        mockQuery.mockResolvedValueOnce([[]]); 
        
        const req = { body: bodyUpdate };
        await editDeliveryFee(req, res);
        
        // Hanya SELECT yang harus dihitung
        expect(mockQuery).toHaveBeenCalledTimes(1); 
        expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(404);
    });
    
    // E4: Edit - Sukses (FIXED: SINKRONISASI URUTAN QUERY)
    test('E4: Seharusnya berhasil UPDATE Delivery Fee dan Laporan Saldo JFS', async () => {
        const res = mockRes();
        const nominalBaru = 25000;
        
        // Mock DB (Sinkronisasi dengan log terakhir): 
        // 1. SELECT Old Data 
        // 2. UPDATE Laporan Keuangan 
        // 3. DELETE Log 
        // 4. INSERT Log
        // 5. UPDATE DF (Kritis)
        
        mockQuery.mockResolvedValueOnce([[{...oldData, tanggal: mockTanggal}]]) // 1. SELECT Old Data
                 .mockResolvedValueOnce([{ affectedRows: 1 }])                  // 2. UPDATE Laporan Keuangan
                 .mockResolvedValueOnce([{}])                                   // 3. DELETE Log
                 .mockResolvedValueOnce([{}])                                   // 4. INSERT Log
                 .mockResolvedValueOnce([{ affectedRows: 1 }]);                 // 5. UPDATE DF 

        const req = { body: { id_input_deliveryfee: idToProcess, nominal: nominalBaru } };
        await editDeliveryFee(req, res);
        
        // Verifikasi Query ke-2 (Update Laporan Keuangan - ini adalah Query yang gagal di assertion sebelumnya)
        expect(mockQuery).toHaveBeenNthCalledWith(2, 
            expect.stringContaining("UPDATE laporan_keuangan SET nominal = ?"),
            expect.arrayContaining([nominalBaru, mockTanggal]) 
        );

        // Verifikasi Query ke-5 (UPDATE DF)
        expect(mockQuery).toHaveBeenNthCalledWith(5,
             expect.stringContaining("UPDATE input_deliveryfee"),
             expect.arrayContaining([nominalBaru, idToProcess]) 
        );

        expect(mockQuery).toHaveBeenCalledTimes(5); 
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);
    });
    
    // D2: Soft Delete (FIXED: Call Count 4)
    test('D2: Seharusnya Soft Delete DF dan DELETE entri Laporan Keuangan', async () => {
        const res = mockRes();
        // Total 4 Query SQL
        // Mock DB: 1. SELECT data lama 2. Update status 3. Delete Laporan 4. Delete Log
        mockQuery.mockResolvedValueOnce([[{...oldData, status: 'active'}]]) // 1. SELECT
                 .mockResolvedValueOnce([{ affectedRows: 1 }])              // 2. UPDATE status (Kritis)
                 .mockResolvedValueOnce([{}])                               // 3. DELETE Laporan
                 .mockResolvedValueOnce([{}]);                              // 4. DELETE Log

        const req = { body: { id_input_deliveryfee: idToProcess } };
        await deleteDeliveryFee(req, res);
        
        // Verifikasi Query ke-3 (Delete Laporan Keuangan)
        expect(mockQuery).toHaveBeenNthCalledWith(3, 
             expect.stringContaining("DELETE FROM laporan_keuangan"),
             expect.arrayContaining([oldData.tanggal, oldData.nominal]) 
        );

        expect(mockQuery).toHaveBeenCalledTimes(4); 
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    // R2: Restore (Sudah Lulus, tinggal diperkuat)
    test('R2: Seharusnya Restore status dan INSERT kembali entri Laporan Keuangan', async () => {
        const res = mockRes();
        // Mock DB: 1. SELECT deleted data 2. Update status 3. Insert Laporan 4. Insert Log
        mockQuery.mockResolvedValueOnce([[{...deletedData, status: 'deleted'}]]) 
                 .mockResolvedValueOnce([{}]) 
                 .mockResolvedValueOnce([{}]) 
                 .mockResolvedValueOnce([{}]);

        const req = { body: { id_input_deliveryfee: idToProcess } };
        await restoreDeliveryFee(req, res);
        
        // Verifikasi Query ke-3 (Insert Laporan Keuangan)
        expect(mockQuery).toHaveBeenNthCalledWith(3, 
             expect.stringContaining("INSERT INTO laporan_keuangan"),
             expect.arrayContaining([oldData.tanggal, oldData.nominal]) 
        );

        expect(mockQuery).toHaveBeenCalledTimes(4); 
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    // P2: Delete Permanent (Sudah Lulus, tinggal diperkuat)
    test('P2: Seharusnya DELETE permanen DF dan entri Laporan Keuangan', async () => {
        const res = mockRes();
        // Mock DB: 1. SELECT data 2. Delete DF 3. Delete Laporan 4. Delete Log
        mockQuery.mockResolvedValueOnce([[{...oldData, status: 'active'}]]) 
                 .mockResolvedValueOnce([{}]) 
                 .mockResolvedValueOnce([{}]) 
                 .mockResolvedValueOnce([{}]);

        const req = { body: { id_input_deliveryfee: idToProcess } };
        await deletePermanentDeliveryFee(req, res);
        
        // Verifikasi Query ke-3 (Delete Laporan Keuangan)
        expect(mockQuery).toHaveBeenNthCalledWith(3, 
             expect.stringContaining("DELETE FROM laporan_keuangan"),
             expect.arrayContaining([oldData.tanggal, oldData.nominal]) 
        );
        
        expect(mockQuery).toHaveBeenCalledTimes(4); 
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);
    });
});