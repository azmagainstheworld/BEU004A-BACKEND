import { jest } from '@jest/globals';

import { 
    parseNominal, formatTanggal, insertPengeluaran, getAllPengeluaran,
    editPengeluaran, deletePengeluaran, restorePengeluaran, deletePermanentPengeluaran, 
    getTrashPengeluaran 
} from "../controllers/input_pengeluaran.js";
import pool from "../config/dbconfig.js";

// ------------------------- MOCKING SECTION -------------------------

const mockRes = () => {
    const res = {};
    res.status = jest.fn(() => res); 
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

// MOCK Date: Tanggal konsisten
const mockTanggal = "2025-12-15"; 
const mockTanggalLama = "2025-12-14"; 

global.Date = class MockDate extends Date {
    constructor() { super(mockTanggal); }
    getFullYear() { return 2025; }
    getMonth() { return 11; } 
    getDate() { return 15; }
};

// SANGAT PENTING: Mendefinisikan mockQuery agar bisa di-reset total
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

const idToProcess = 50;
const oldData = {
    id_input_pengeluaran: idToProcess, tanggal_pengeluaran: mockTanggalLama, nominal_pengeluaran: 20000,
    jenis_pengeluaran: "Kasbon", jenis_pembayaran: "Cash", status: 'active'
};
const deletedData = { ...oldData, status: 'deleted' };

// ------------------------- UTILITY TEST -------------------------

describe('parseNominal Utility', () => {
    test('Seharusnya throw error jika nominal < 1000', () => { expect(() => parseNominal("500")).toThrow("Nominal minimal 1.000"); });
    test('Seharusnya mengembalikan angka dari string Rupiah', () => { expect(parseNominal("10.000")).toBe(10000); });
    test('Seharusnya throw error jika nominal non-angka', () => { expect(() => parseNominal("abc")).toThrow("Nominal minimal 1.000"); });
    test('Seharusnya mengembalikan tanggal format yyyy-mm-dd', () => { expect(formatTanggal()).toBe(mockTanggal); });
});

// ------------------------- INSERT -------------------------

describe('insertPengeluaran Controller', () => {
    const res = mockRes();
    
    beforeEach(() => { 
        mockQuery.mockReset(); 
        jest.clearAllMocks(); 
    });

    test('T1: Seharusnya INSERT Pengeluaran dan Laporan Kas (Negatif)', async () => {
        const nominal = 25000;
        mockQuery.mockResolvedValueOnce([{ insertId: 123 }]) 
                  .mockResolvedValueOnce([{}]) 
                  .mockResolvedValueOnce([{}]); 
        const req = { body: { nominal_pengeluaran: nominal, jenis_pengeluaran: "Operasional", jenis_pembayaran: "Cash", deskripsi: "Bayar parkir", id_karyawan: null } };
        await insertPengeluaran(req, res);
        expect(mockQuery).toHaveBeenCalledTimes(3); 
        expect(mockConnection.commit).toHaveBeenCalledTimes(1); 
    });

    test('V4: Seharusnya 400 jika jenis=Kasbon tapi id_karyawan kosong', async () => {
        const req = { body: { jenis_pengeluaran: "Kasbon", jenis_pembayaran: "Cash", nominal_pengeluaran: "50000" } };
        await insertPengeluaran(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('T2: Seharusnya INSERT 1 Pengeluaran, 1 Laporan Saldo JFS (Positif) dan 1 Laporan Kas/Transfer (Negatif)', async () => {
        const nominal = 100000;
        mockQuery.mockResolvedValueOnce([{ insertId: 456 }]) 
                  .mockResolvedValueOnce([{}]) 
                  .mockResolvedValueOnce([{}]) 
                  .mockResolvedValueOnce([{}]); 
        const req = { body: { nominal_pengeluaran: nominal, jenis_pengeluaran: "Top Up Saldo JFS", jenis_pembayaran: "Transfer", deskripsi: "Transfer ke rekening JFS" } };
        await insertPengeluaran(req, res);
        expect(mockQuery).toHaveBeenCalledTimes(4);
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    });

    test('E1: Seharusnya mengembalikan 500 dan Rollback jika gagal INSERT Laporan Keuangan', async () => {
        mockQuery.mockResolvedValueOnce([{ insertId: 789 }]) 
                 .mockRejectedValueOnce(new Error("Gagal Insert Laporan Keuangan")); 
        const req = { body: { nominal_pengeluaran: "10000", jenis_pengeluaran: "Top Up Saldo JFS", jenis_pembayaran: "Transfer" } };
        await insertPengeluaran(req, res);
        expect(mockQuery).toHaveBeenCalledTimes(2); 
        expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ------------------------- GET ALL & GET TRASH -------------------------

describe('Read Pengeluaran Controllers (Access Control)', () => {
    const res = mockRes();
    beforeEach(() => { mockQuery.mockReset(); });

    test('A1: Seharusnya mengambil semua pengeluaran aktif jika Super Admin', async () => {
        mockQuery.mockResolvedValueOnce([[{ id: 1, nominal: 10000 }]]);
        const req = { user: { roles: ['Super Admin'] } };
        await getAllPengeluaran(req, res);
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    test('A2: Seharusnya mengambil pengeluaran hari ini jika Admin', async () => {
        mockQuery.mockResolvedValueOnce([[{ id: 2, nominal: 5000 }]]);
        const req = { user: { roles: ['Admin'] } };
        await getAllPengeluaran(req, res);
        expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    test('A3: Seharusnya 403 jika peran tidak diizinkan', async () => {
        const req = { user: { roles: ['User'] } };
        await getAllPengeluaran(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    test('A4: Seharusnya mengambil data deleted jika getTrashPengeluaran', async () => {
        mockQuery.mockResolvedValueOnce([[{ id: 3, status: 'deleted' }]]);
        await getTrashPengeluaran({}, res);
        expect(res.status).toHaveBeenCalledWith(200);
    });
});

// ------------------------- EDIT -------------------------

describe('editPengeluaran Controller', () => {
    const res = mockRes();
    const bodyUpdate = { id_pengeluaran: 100, nominal_pengeluaran: "10.000", jenis_pengeluaran: "Lainnya", jenis_pembayaran: "Transfer", deskripsi: "Deskripsi baru" };

    beforeEach(() => { mockQuery.mockReset(); });

    test('E3: Seharusnya berhasil mereverse Top Up JFS lama & menerapkan Lainnya baru', async () => {
        const oldDataTopUp = { 
            id_input_pengeluaran: 100, tanggal_pengeluaran: mockTanggalLama, nominal_pengeluaran: 50000, 
            jenis_pengeluaran: "Top Up Saldo JFS", jenis_pembayaran: "Cash" 
        };
        
        mockQuery.mockResolvedValueOnce([[oldDataTopUp], []]) 
                .mockResolvedValueOnce([{}, []])        
                .mockResolvedValueOnce([{}, []])        
                .mockResolvedValueOnce([{}, []])        
                .mockResolvedValueOnce([{}, []])        
                .mockResolvedValueOnce([{}, []])        
                .mockResolvedValueOnce([{}, []]);       
        
        await editPengeluaran({ body: bodyUpdate }, res);
        expect(mockQuery).toHaveBeenCalledTimes(7); 
        expect(mockConnection.commit).toHaveBeenCalledTimes(1); 
    });
});

