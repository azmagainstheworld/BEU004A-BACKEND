import { jest } from '@jest/globals';
import { 
    getAllOutgoing, insertOutgoing, editOutgoing, 
    deleteOutgoing, getTrashOutgoing, restoreOutgoing, 
    deletePermanentOutgoing
} from "../controllers/input_outgoing.js"; 
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

// Data Umum (Variabel Global untuk Tes)
const idToProcess = 100;
const nominal = 100000;
const potongan = 10000;
const nominalBersih = 90000;
const potonganJFS = nominalBersih * 0.6; // 54000
const nominalJFSNegative = -potonganJFS; // -54000

const oldData = {
    id_input_outgoing: idToProcess,
    tanggal_outgoing: mockTanggalLama, 
    nominal: 100000,
    potongan_outgoing: 10000,
    nominal_bersih: 90000,
    jenis_pembayaran: "Cash",
    status: 'active'
};
const deletedData = { ...oldData, status: 'deleted' };

// VARIABEL UNTUK EDIT TEST (Di-scope global)
const bodyUpdate = { 
    id_input_outgoing: idToProcess, 
    nominal: "120000", 
    potongan: "20000", 
    jenis_pembayaran: "Transfer" 
};
const nominalBersihBaru = 100000;
const nominalJFSNegativeBaru = -(100000 * 0.6); // -60000

// ------------------------- INSERT TESTS -------------------------

describe('Outgoing Insert Controller', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        mockConnection.commit.mockClear();
        mockConnection.rollback.mockClear();
        mockQuery.mockClear();
    });
    
    // V1: Validasi Nominal Bersih
    test('V1: Seharusnya 400 jika nominal bersih negatif', async () => {
        const res = mockRes();
        const req = { body: { nominal: "10000", potongan: "15000", jenis_pembayaran: "Cash" } };
        await insertOutgoing(req, res);
        
        expect(mockQuery).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });
    
    // V2: Validasi Jenis Pembayaran
    test('V2: Seharusnya 400 jika jenis_pembayaran tidak valid', async () => {
        const res = mockRes();
        const req = { body: { nominal: "50000", jenis_pembayaran: "Kredit" } };
        await insertOutgoing(req, res);
        
        expect(mockQuery).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    // T1: Sukses Insert
    test('T1: Seharusnya berhasil INSERT Outgoing dan mencatat 60% Saldo JFS negatif (Cash)', async () => {
        const res = mockRes();
        // Mock DB: 1. Insert Outgoing 2. Insert Laporan Kas 3. Insert Laporan Saldo JFS 4. Insert Log
        mockQuery.mockResolvedValueOnce([{ insertId: idToProcess }])
                 .mockResolvedValueOnce([{}])
                 .mockResolvedValueOnce([{}])
                 .mockResolvedValueOnce([{}]);
        
        const req = { body: { nominal: nominal, potongan: potongan, jenis_pembayaran: "Cash" } };
        await insertOutgoing(req, res);

        // Assert Query 3: Laporan Saldo JFS (Pengurangan)
        expect(mockQuery).toHaveBeenNthCalledWith(3, 
            expect.stringContaining("INSERT INTO laporan_keuangan"),
            expect.arrayContaining([mockTanggal, nominalJFSNegative]) 
        );

        expect(mockQuery).toHaveBeenCalledTimes(4); 
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalledWith(500);
    });

    // E1: Gagal Insert (Rollback Test)
    test('E1: Seharusnya ROLLBACK dan mengembalikan 500 jika gagal INSERT Saldo JFS', async () => {
        const res = mockRes();
        // Mock DB: 1. Insert Outgoing 2. Insert Laporan Kas 3. Insert Saldo JFS (Gagal)
        mockQuery.mockResolvedValueOnce([{ insertId: idToProcess }])
                 .mockResolvedValueOnce([{}])
                 .mockRejectedValueOnce(new Error("DB error")); 
        
        const req = { body: { nominal: nominal, jenis_pembayaran: "Transfer" } };
        await insertOutgoing(req, res);

        expect(mockQuery).toHaveBeenCalledTimes(3); 
        expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ------------------------- EDIT & LIFECYCLE TESTS -------------------------

describe('Outgoing Edit and Lifecycle Controllers', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        mockConnection.commit.mockClear();
        mockConnection.rollback.mockClear();
        mockQuery.mockClear();
    });

    // E2: Edit - Data Not Found (FIXED: Call Count 1)
    test('E2: Seharusnya 404 jika data edit tidak ditemukan', async () => {
        const res = mockRes(); 
        // Query 1: SELECT (kembalikan data kosong)
        mockQuery.mockResolvedValueOnce([[]]); 
        
        const req = { body: bodyUpdate }; 
        await editOutgoing(req, res);
        
        expect(mockQuery).toHaveBeenCalledTimes(1); 
        expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    // E3: Edit - Sukses (FIXED: Call Count 8)
    test('E3: Seharusnya berhasil UPDATE Outgoing, DELETE transaksi lama, dan INSERT transaksi baru', async () => {
        const res = mockRes(); 
        // Total 8 Query SQL.
        // Mock DB: 1. SELECT 2. UPDATE Outgoing 3. DELETE Kas Lama 4. DELETE JFS Lama 5. INSERT Transfer Baru 6. INSERT JFS Baru 7. DELETE Log 8. INSERT Log
        mockQuery.mockResolvedValueOnce([[{...oldData, nominal_bersih: nominalBersih}]]) // 1. SELECT Old Data
                 .mockResolvedValueOnce([{ affectedRows: 1 }])                          // 2. UPDATE Outgoing (Kritis)
                 .mockResolvedValueOnce([{}])                                           
                 .mockResolvedValueOnce([{}])                                           
                 .mockResolvedValueOnce([{}])                                           
                 .mockResolvedValueOnce([{}])                                           
                 .mockResolvedValueOnce([{}])                                           
                 .mockResolvedValueOnce([{}]);                                          

        const req = { body: bodyUpdate };
        await editOutgoing(req, res);
        
        // Assert Query 6: INSERT Saldo JFS Baru
        expect(mockQuery).toHaveBeenNthCalledWith(6, 
            expect.stringContaining("INSERT INTO laporan_keuangan"),
            expect.arrayContaining([mockTanggal, nominalJFSNegativeBaru]) 
        );

        expect(mockQuery).toHaveBeenCalledTimes(8); 
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    // D1: Soft Delete (FIXED: Call Count 5)
    test('D1: Seharusnya Soft Delete Outgoing dan Reverse 2 entri Laporan Keuangan', async () => {
        const res = mockRes(); 
        // Total 5 Query SQL
        // Mock DB: 1. SELECT data lama 2. Update status 3. Delete Kas Lama 4. Delete JFS Lama 5. Delete Log
        mockQuery.mockResolvedValueOnce([[{...oldData, status: 'active'}]]) // 1. SELECT
                 .mockResolvedValueOnce([{ affectedRows: 1 }])              // 2. UPDATE (Kritis)
                 .mockResolvedValueOnce([{}])                               // 3. DELETE Kas
                 .mockResolvedValueOnce([{}])                               // 4. DELETE JFS
                 .mockResolvedValueOnce([{}]);                              // 5. DELETE Log

        const req = { body: { id_input_outgoing: idToProcess } };
        await deleteOutgoing(req, res);
        
        // Assert Query 4: DELETE Saldo JFS
        expect(mockQuery).toHaveBeenNthCalledWith(4, 
             expect.stringContaining("DELETE FROM laporan_keuangan"),
             expect.arrayContaining([oldData.tanggal_outgoing, nominalJFSNegative]) 
        );

        expect(mockQuery).toHaveBeenCalledTimes(5); 
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    // R1: Restore (FIXED: Call Count 6)
    test('R1: Seharusnya Restore status dan Re-apply 2 entri Laporan Keuangan', async () => {
        const res = mockRes();
        // Total 6 Query SQL
        // Mock DB: 1. SELECT deleted data 2. Update status 3. Insert Kas Baru 4. Insert JFS Baru 5. Delete Log 6. Insert Log
        mockQuery.mockResolvedValueOnce([[{...deletedData, status: 'deleted'}]]) 
                 .mockResolvedValueOnce([{}]) 
                 .mockResolvedValueOnce([{}]) 
                 .mockResolvedValueOnce([{}]) 
                 .mockResolvedValueOnce([{}]) 
                 .mockResolvedValueOnce([{}]);

        const req = { body: { id_input_outgoing: idToProcess } };
        await restoreOutgoing(req, res);
        
        // Assert Query 4: INSERT Saldo JFS
        expect(mockQuery).toHaveBeenNthCalledWith(4, 
             expect.stringContaining("INSERT INTO laporan_keuangan"),
             expect.arrayContaining([oldData.tanggal_outgoing, nominalJFSNegative]) 
        );

        expect(mockQuery).toHaveBeenCalledTimes(6); 
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    // P1: Delete Permanent (FIXED: Call Count 5)
    test('P1: Seharusnya DELETE permanen Outgoing dan 4 entri terkait Laporan Keuangan/Log', async () => {
        const res = mockRes();
        // Total 5 Query SQL
        // Mock DB: 1. SELECT data lama 2. Delete Laporan Kas 3. Delete Laporan JFS 4. Delete Log 5. Delete Outgoing
        mockQuery.mockResolvedValueOnce([[{...oldData, status: 'deleted'}]]) 
                 .mockResolvedValueOnce([{}]) 
                 .mockResolvedValueOnce([{}]) 
                 .mockResolvedValueOnce([{}]) 
                 .mockResolvedValueOnce([{}]);

        const req = { body: { id_input_outgoing: idToProcess } };
        await deletePermanentOutgoing(req, res);
        
        // Assert Query 5: DELETE FROM input_outgoing
        expect(mockQuery).toHaveBeenNthCalledWith(5, 
             expect.stringContaining("DELETE FROM input_outgoing"),
             expect.arrayContaining([idToProcess]) 
        );
        
        expect(mockQuery).toHaveBeenCalledTimes(5); 
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    // A2: Read Access Denied
    test('A2: Seharusnya 403 jika peran tidak diizinkan', async () => {
        const res = mockRes();
        pool.query.mockClear(); 
        const req = { user: { roles: ['User Biasa'] } };
        await getAllOutgoing(req, res);
        
        expect(res.status).toHaveBeenCalledWith(403);
        expect(pool.query).not.toHaveBeenCalled();
    });
    
    // A1: Super Admin (Read)
    test('A1: Seharusnya mengambil semua data aktif jika Super Admin', async () => {
        const res = mockRes();
        pool.query.mockResolvedValueOnce([[{ id: 1, nominal: 10000 }]]);
        const req = { user: { roles: ['Super Admin'] } };
        await getAllOutgoing(req, res);
        expect(pool.query).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalledWith(403);
    });
});