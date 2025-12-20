// __tests__/karyawan.test.js

import { jest } from '@jest/globals'; 

import { 
    getAllKaryawan, getTrashKaryawan, getKaryawanById,
    createKaryawan, editKaryawan, deleteKaryawan,
    restoreKaryawan, deletePermanentKaryawan
} from "../controllers/karyawan.js"; // Pastikan path benar
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
const idToProcess = 5;
const testKaryawan = {
    id_karyawan: idToProcess,
    nama_karyawan: 'Budi Santoso',
    jenis_kelamin: 'Laki-laki',
    ttl: '1990-01-01',
    alamat: 'Jl. Merdeka No. 10',
    status: 'active'
};
const deletedKaryawan = { ...testKaryawan, status: 'deleted' };

// ------------------------- READ CONTROLLERS TESTS -------------------------

describe('Karyawan Read Controllers', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockClear();
    });

    // R1: GetAll Karyawan (Active)
    test('R1: Seharusnya mengambil semua data karyawan aktif', async () => {
        const res = mockRes();
        mockQuery.mockResolvedValueOnce([[testKaryawan, {...testKaryawan, id_karyawan: 6}]]);
        
        const req = {};
        await getAllKaryawan(req, res);
        
        expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM karyawan WHERE status = 'active'");
        expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([testKaryawan]));
    });

    // R2: Get Trash Karyawan (Deleted)
    test('R2: Seharusnya mengambil semua data karyawan deleted', async () => {
        const res = mockRes();
        mockQuery.mockResolvedValueOnce([[deletedKaryawan]]);
        
        const req = {};
        await getTrashKaryawan(req, res);
        
        expect(mockQuery).toHaveBeenCalledWith("SELECT * FROM karyawan WHERE status = 'deleted'");
        expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([deletedKaryawan]));
    });

    // R3: Get By ID - Success
    test('R3: Seharusnya mengambil karyawan berdasarkan ID', async () => {
        const res = mockRes();
        mockQuery.mockResolvedValueOnce([[testKaryawan]]); // Mengembalikan array of rows
        
        const req = { body: { id_karyawan: idToProcess } };
        await getKaryawanById(req, res);
        
        expect(mockQuery).toHaveBeenCalledWith(
            "SELECT * FROM karyawan WHERE id_karyawan = ?",
            [idToProcess]
        );
        expect(res.json).toHaveBeenCalledWith(testKaryawan);
    });

    // E1: Get By ID - Not Found (404)
    test('E1: Seharusnya 404 jika ID karyawan tidak ditemukan', async () => {
        const res = mockRes();
        mockQuery.mockResolvedValueOnce([[]]); // Mengembalikan array kosong
        
        const req = { body: { id_karyawan: 99 } };
        await getKaryawanById(req, res);
        
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Karyawan not found" }));
    });
});

// ------------------------- CREATE CONTROLLER TESTS -------------------------

describe('Karyawan Create Controller', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockClear();
    });

    // T1: Create Success
    test('T1: Seharusnya berhasil menambah karyawan dan mengembalikan 201', async () => {
        const res = mockRes();
        const { nama_karyawan, jenis_kelamin, ttl, alamat } = testKaryawan;
        
        // Mock result: insertId
        mockQuery.mockResolvedValueOnce([{ insertId: idToProcess }]);
        
        const req = { body: { nama_karyawan, jenis_kelamin, ttl, alamat } };
        await createKaryawan(req, res);

        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO karyawan"),
            [nama_karyawan, jenis_kelamin, ttl, alamat]
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id_karyawan: idToProcess }));
    });

    // E2: Create Failure (Server Error)
    test('E2: Seharusnya mengembalikan 500 jika gagal insert ke DB', async () => {
        const res = mockRes();
        const { nama_karyawan, jenis_kelamin, ttl, alamat } = testKaryawan;
        
        mockQuery.mockRejectedValueOnce(new Error("DB Connection Error"));
        
        const req = { body: { nama_karyawan, jenis_kelamin, ttl, alamat } };
        await createKaryawan(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Internal Server Error" }));
    });
});

// ------------------------- UPDATE CONTROLLER TESTS -------------------------

describe('Karyawan Update Controller', () => {
    const newAlamat = 'Jl. Baru No. 5';

    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockClear();
    });

    // V3: Update - Missing ID
    test('V3: Seharusnya 400 jika id_karyawan tidak diisi', async () => {
        const res = mockRes();
        const req = { body: { nama_karyawan: 'Test' } };
        await editKaryawan(req, res);
        
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "id_karyawan wajib diisi" }));
        expect(mockQuery).not.toHaveBeenCalled();
    });
    
    // V4: Update - No fields provided
    test('V4: Seharusnya 400 jika tidak ada data yang diperbarui', async () => {
        const res = mockRes();
        const req = { body: { id_karyawan: idToProcess } };
        await editKaryawan(req, res);
        
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Tidak ada data yang diperbarui" }));
        expect(mockQuery).not.toHaveBeenCalled();
    });

    // T2: Update Success (Partial fields)
    // T2: Update Success (FIXED: Memastikan affectedRows: 1)
    test('T2: Seharusnya berhasil update partial field (alamat) dan mengembalikan 200', async () => {
        const res = mockRes();
        // Mock result: affectedRows = 1
        mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]); 
        
        const req = { body: { id_karyawan: idToProcess, alamat: newAlamat } };
        await editKaryawan(req, res);

        expect(mockQuery).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE karyawan SET alamat = ? WHERE id_karyawan = ?"),
            [newAlamat, idToProcess]
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Karyawan updated" }));
    });

    // E3: Update - Not Found (404)
    test('E3: Seharusnya 404 jika ID tidak ditemukan saat update', async () => {
        const res = mockRes();
        mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }]);
        
        const req = { body: { id_karyawan: 99, nama_karyawan: 'Test' } };
        await editKaryawan(req, res);
        
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Karyawan not found" }));
    });
});

// ------------------------- LIFECYCLE CONTROLLERS TESTS -------------------------

describe('Karyawan Lifecycle Controllers (Delete, Restore, Permanent Delete)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockClear();
    });

    // D2: Soft Delete - Success (FIXED: Memastikan affectedRows: 1)
    test('D2: Seharusnya berhasil soft delete karyawan (UPDATE status = deleted)', async () => {
        const res = mockRes();
        mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]); 
        
        const req = { body: { id_karyawan: idToProcess } };
        await deleteKaryawan(req, res);
        
        expect(mockQuery).toHaveBeenCalledTimes(1); // Non-transactional, hanya 1 query
        expect(mockQuery).toHaveBeenCalledWith(
            "UPDATE karyawan SET status = 'deleted' WHERE id_karyawan = ?",
            [idToProcess]
        );
        expect(res.status).toHaveBeenCalledWith(200);
    });

    // D3: Soft Delete - Not Found
    test('D3: Seharusnya 404 jika ID tidak ditemukan saat soft delete', async () => {
        const res = mockRes();
        mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }]); 
        
        const req = { body: { id_karyawan: 99 } };
        await deleteKaryawan(req, res);
        
        expect(res.status).toHaveBeenCalledWith(404);
    });

    // R4: Restore - Success
    // R4: Restore - Success (FIXED: Memastikan affectedRows: 1)
        test('R4: Seharusnya berhasil restore karyawan (UPDATE status = active)', async () => {
            const res = mockRes();
            mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]); 
            
            const req = { body: { id_karyawan: idToProcess } };
            await restoreKaryawan(req, res);
            
            expect(mockQuery).toHaveBeenCalledTimes(1); // Non-transactional, hanya 1 query
            expect(mockQuery).toHaveBeenCalledWith(
                "UPDATE karyawan SET status = 'active' WHERE id_karyawan = ?",
                [idToProcess]
            );
            expect(res.status).toHaveBeenCalledWith(200);
        });

        // P5: Delete Permanent - Success (FIXED: Memastikan affectedRows: 1)
        test('P5: Seharusnya berhasil menghapus karyawan secara permanen (DELETE FROM)', async () => {
            const res = mockRes();
            mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]); 
            
            const req = { body: { id_karyawan: idToProcess } };
            await deletePermanentKaryawan(req, res);
            
            expect(mockQuery).toHaveBeenCalledTimes(1); // Non-transactional, hanya 1 query
            expect(mockQuery).toHaveBeenCalledWith(
                "DELETE FROM karyawan WHERE id_karyawan = ?",
                [idToProcess]
            );
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });
