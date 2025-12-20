// __tests__/manajemen_gaji.test.js

import { jest } from '@jest/globals'; 
import { 
    getAllManajemenGaji, saveManajemenGaji, getManajemenGajiById 
} from "../controllers/manajemen_gaji.js"; 
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

// Data Umum
const idKaryawan = 15;
const upahPerhari = 100000;
const bonus = 500000;

const mockGajiData = {
    id_karyawan: idKaryawan,
    nama_karyawan: 'Dewi Lestari',
    upah_perhari: upahPerhari,
    bonus: bonus
};
const mockGajiRow = [mockGajiData];

// ------------------------- GET ALL & GET BY ID TESTS -------------------------

describe('Manajemen Gaji Read Controllers', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockClear();
    });

    // R1: GetAllManajemenGaji Success
    test('R1: Seharusnya mengambil semua gaji dengan LEFT JOIN karyawan', async () => {
        const res = mockRes();
        mockQuery.mockResolvedValueOnce([mockGajiRow]);
        
        const req = {};
        await getAllManajemenGaji(req, res);
        
        expect(mockQuery).toHaveBeenCalledTimes(1);
        expect(mockQuery.mock.calls[0][0]).toContain('LEFT JOIN manajemen_gaji mg');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(mockGajiRow);
    });

    // R2: GetManajemenGajiById Success
    test('R2: Seharusnya mengambil data gaji berdasarkan id_karyawan (BODY)', async () => {
        const res = mockRes();
        mockQuery.mockResolvedValueOnce([mockGajiRow]); // Mengembalikan [row]
        
        const req = { body: { id_karyawan: idKaryawan } };
        await getManajemenGajiById(req, res);
        
        expect(mockQuery).toHaveBeenCalledTimes(1);
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining("WHERE mg.id_karyawan = ?"),
            [idKaryawan]
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(mockGajiData); // Hanya mengirim object pertama
    });

    // E1: GetManajemenGajiById - Missing ID
    test('E1: Seharusnya 400 jika id_karyawan kosong saat Get By ID', async () => {
        const res = mockRes();
        const req = { body: {} };
        await getManajemenGajiById(req, res);
        
        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    // E2: GetManajemenGajiById - Not Found (404)
    test('E2: Seharusnya 404 jika data gaji untuk id_karyawan tidak ditemukan', async () => {
        const res = mockRes();
        mockQuery.mockResolvedValueOnce([[]]); // Tidak ada hasil
        
        const req = { body: { id_karyawan: 999 } };
        await getManajemenGajiById(req, res);
        
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Data tidak ditemukan" }));
    });
});

// ------------------------- SAVE/UPDATE (UPSERT) TESTS -------------------------

describe('Manajemen Gaji Save/Update Controller (Upsert)', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockClear();
    });

    // V3: Save - Missing ID or Upah
    test('V3: Seharusnya 400 jika id_karyawan atau upah_perhari kosong', async () => {
        const res = mockRes();
        const req = { body: { id_karyawan: idKaryawan } }; // upah_perhari kosong
        await saveManajemenGaji(req, res);
        
        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    // T3: Insert Baru (Bonus 0)
    test('T3: Seharusnya INSERT data baru jika belum ada (bonus default 0)', async () => {
        const res = mockRes();
        // affectedRows = 1 (insert)
        mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]); 
        
        const req = { body: { id_karyawan: idKaryawan, upah_perhari: upahPerhari, bonus: null } };
        await saveManajemenGaji(req, res);
        
        expect(mockQuery).toHaveBeenCalledTimes(1);
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO manajemen_gaji"),
            [idKaryawan, upahPerhari, 0] // Bonus diisi 0
        );
        expect(mockQuery.mock.calls[0][0]).toContain('ON DUPLICATE KEY UPDATE');
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Data manajemen gaji berhasil disimpan" }));
    });

    // T4: Update Data (Bonus diisi)
    test('T4: Seharusnya UPDATE data jika sudah ada (upsert logic) dengan bonus baru', async () => {
        const res = mockRes();
        const newUpah = 120000;
        const newBonus = 750000;
        
        // affectedRows = 2 (update)
        mockQuery.mockResolvedValueOnce([{ affectedRows: 2 }]); 
        
        const req = { body: { id_karyawan: idKaryawan, upah_perhari: newUpah, bonus: newBonus } };
        await saveManajemenGaji(req, res);
        
        expect(mockQuery).toHaveBeenCalledTimes(1);
        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining("ON DUPLICATE KEY UPDATE"),
            [idKaryawan, newUpah, newBonus] 
        );
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Data manajemen gaji berhasil disimpan" }));
    });

    // E4: Save/Update Failure (Server Error)
    test('E4: Seharusnya mengembalikan 500 jika query Upsert gagal', async () => {
        const res = mockRes();
        mockQuery.mockRejectedValueOnce(new Error("DB Constraint Violation"));
        
        const req = { body: { id_karyawan: idKaryawan, upah_perhari: upahPerhari } };
        await saveManajemenGaji(req, res);
        
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Internal Server Error" }));
    });
});