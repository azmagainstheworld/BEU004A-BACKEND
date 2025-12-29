// __tests__/karyawan.test.js
import { jest } from '@jest/globals'; 

// Import controller yang akan diuji
import { 
    getAllKaryawan, getTrashKaryawan, getKaryawanById,
    createKaryawan, editKaryawan, deleteKaryawan,
    restoreKaryawan, deletePermanentKaryawan
} from "../controllers/karyawan.js";
import pool from "../config/dbconfig.js"; 

// ------------------------- MOCKING SETUP -------------------------

const mockRes = () => {
    const res = {};
    res.status = jest.fn(() => res); 
    res.json = jest.fn();
    return res;
};

// Mock Pool.query global agar tidak mengubah DB asli
const mockQuery = jest.fn();
pool.query = mockQuery; 

// Data Dummy untuk Testing
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

// ------------------------- TEST SUITES -------------------------

describe('Karyawan Module - Unit Testing', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- 1. PENGUJIAN READ (GET) ---
    describe('Read Controllers', () => {
        test('R1: GetAll - Mengambil semua data karyawan aktif', async () => {
            const req = { user: { role: 'Admin' } };
            const res = mockRes();
            mockQuery.mockResolvedValueOnce([[testKaryawan]]);
            
            await getAllKaryawan(req, res);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("status = 'active'"));
            expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([testKaryawan]));
        });

        test('R2: GetByID - Mengambil karyawan berdasarkan ID', async () => {
            const req = { body: { id_karyawan: idToProcess } };
            const res = mockRes();
            mockQuery.mockResolvedValueOnce([[testKaryawan]]); 
            
            await getKaryawanById(req, res);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("WHERE id_karyawan = ?"), [idToProcess]);
            expect(res.json).toHaveBeenCalledWith(testKaryawan);
        });
    });

    // --- 2. PENGUJIAN CREATE ---
    describe('Create Controller', () => {
        test('T1: Sukses menambah karyawan baru (Super Admin)', async () => {
            const req = { 
                user: { role: 'Super Admin' },
                body: { nama_karyawan: 'Ani', jenis_kelamin: 'Perempuan', ttl: '1995-05-05', alamat: 'Balikpapan' } 
            };
            const res = mockRes();
            mockQuery.mockResolvedValueOnce([{ insertId: 10 }]);

            await createKaryawan(req, res);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Karyawan created" }));
        });

        test('V1: Gagal jika diakses oleh selain Super Admin', async () => {
            const req = { user: { role: 'Admin' } };
            const res = mockRes();
            await createKaryawan(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    // --- 3. PENGUJIAN UPDATE ---
    describe('Update Controller', () => {
        test('T2: Sukses update alamat karyawan', async () => {
            const req = { 
                user: { role: 'Super Admin' },
                body: { id_karyawan: idToProcess, alamat: 'Jl. Ahmad Yani' } 
            };
            const res = mockRes();
            mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

            await editKaryawan(req, res);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("UPDATE karyawan SET alamat = ?"), expect.anything());
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Karyawan updated" }));
        });
    });

    // --- 4. PENGUJIAN LIFECYCLE (DELETE & RESTORE) ---
    describe('Lifecycle Controllers', () => {
        test('D1: Soft Delete - Mengubah status menjadi deleted', async () => {
            const req = { user: { role: 'Super Admin' }, body: { id_karyawan: idToProcess } };
            const res = mockRes();
            mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

            await deleteKaryawan(req, res);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("status = 'deleted'"), [idToProcess]);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Karyawan moved to trash" }));
        });

        test('R1: Restore - Mengembalikan status menjadi active', async () => {
            const req = { user: { role: 'Super Admin' }, body: { id_karyawan: idToProcess } };
            const res = mockRes();
            mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

            await restoreKaryawan(req, res);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("status = 'active'"), [idToProcess]);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Karyawan restored" }));
        });

        test('P1: Permanent Delete - Menghapus data fisik dari tabel', async () => {
            const req = { user: { role: 'Super Admin' }, body: { id_karyawan: idToProcess } };
            const res = mockRes();
            mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);

            await deletePermanentKaryawan(req, res);
            expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM karyawan"), [idToProcess]);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Karyawan permanently deleted" }));
        });
    });
});