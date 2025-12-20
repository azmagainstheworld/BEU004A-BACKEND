// __tests__/presensi.test.js

import { jest } from '@jest/globals'; 
import { 
    getAllPresensi, insertPresensi, editPresensi 
} from "../controllers/presensi.js";
import pool from "../config/dbconfig.js"; 

// ------------------------- MOCKING SECTION -------------------------

// MOCK res
const mockRes = () => {
    const res = {};
    res.status = jest.fn(() => res); 
    res.json = jest.fn();
    return res;
};

// MOCK Date and Time Zone (WITA - Asia/Makassar)
const mockDateString = "2025-12-15"; // Format YYYY-MM-DD
const mockTimeString = "10:30:00"; 

// Pastikan global Date dimock agar toLocaleDateString/Time konsisten
global.Date = class MockDate extends Date {
    constructor() {
        super(mockDateString + 'T' + mockTimeString + '.000Z'); 
    }
    toLocaleDateString(locale, options) { return mockDateString; }
    toLocaleTimeString(locale, options) { return mockTimeString; }
};

// MOCK Pool.query
const mockQuery = jest.fn();
pool.query = mockQuery; 

// Data Umum
const idKaryawan = 1;
const idPresensi = 101;
const dataPresensi = {
    id_presensi: idPresensi,
    id_karyawan: idKaryawan,
    tanggal_presensi: mockDateString,
    waktu_presensi: mockTimeString,
    kehadiran: 'Hadir',
    nama_karyawan: 'Adi Budi'
};

// ------------------------- GET ALL PRESENSI TESTS -------------------------

describe('Presensi Read Controller', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockClear();
    });

    // R1: GetAll Presensi Success
    test('R1: Seharusnya mengambil semua data presensi dengan JOIN karyawan', async () => {
        const res = mockRes();
        mockQuery.mockResolvedValueOnce([[dataPresensi, {...dataPresensi, id_presensi: 102}]]);
        
        const req = {};
        await getAllPresensi(req, res);
        
        // --- PERBAIKAN DI SINI ---
        const query = mockQuery.mock.calls[0][0];
        
        // Cek bagian penting: JOIN karyawan dan SELECT p.*
        expect(query).toMatch(/SELECT.*p\.\*.*k\.nama_karyawan/);
        expect(query).toMatch(/FROM presensi p/);
        expect(query).toMatch(/JOIN karyawan k/); 
        
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([dataPresensi]));
    });

    // E1: GetAll Presensi Failure
    test('E1: Seharusnya mengembalikan 500 jika Query gagal', async () => {
        const res = mockRes();
        mockQuery.mockRejectedValueOnce(new Error("DB Error"));
        
        const req = {};
        await getAllPresensi(req, res);
        
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

// ------------------------- INSERT PRESENSI (UPSERT LOGIC) TESTS -------------------------

describe('Presensi Insert Controller (UPSERT Logic)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockClear();
    });
    
    // V1: Validasi Input
    test('V1: Seharusnya 400 jika id_karyawan atau kehadiran kosong', async () => {
        const res = mockRes();
        const req = { body: { id_karyawan: idKaryawan } }; 
        await insertPresensi(req, res);
        
        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    // T2: INSERT BARU (Kehadiran Pertama: Hadir)
    test('T2: Seharusnya INSERT presensi baru jika belum ada hari ini (Kehadiran: Hadir)', async () => {
        const res = mockRes();
        
        // Mock Query 1 (SELECT existing): return empty array
        mockQuery.mockResolvedValueOnce([[]]); 
        
        // Mock Query 2 (INSERT new)
        mockQuery.mockResolvedValueOnce([{ insertId: idPresensi }]);
        
        const req = { body: { id_karyawan: idKaryawan, kehadiran: 'Hadir' } };
        await insertPresensi(req, res);

        // Verifikasi Query 2: Insert data baru
        expect(mockQuery).toHaveBeenNthCalledWith(2, 
            expect.stringContaining("INSERT INTO presensi"),
            [idKaryawan, mockDateString, mockTimeString, 'Hadir']
        );
        
        expect(res.status).toHaveBeenCalledWith(201);
        expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    // T3: UPDATE (Kehadiran Diperbarui: Tidak Hadir)
    test('T3: Seharusnya UPDATE presensi jika sudah ada hari ini (Ganti status menjadi: Tidak Hadir)', async () => {
        const res = mockRes();
        
        // Mock Query 1 (SELECT existing): return existing data (misalnya, status sebelumnya 'Hadir')
        mockQuery.mockResolvedValueOnce([[{ id_presensi: idPresensi, kehadiran: 'Hadir' }]]); 
        
        // Mock Query 2 (UPDATE)
        mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
        
        const req = { body: { id_karyawan: idKaryawan, kehadiran: 'Tidak Hadir' } };
        await insertPresensi(req, res);
        
        // Verifikasi Query 2: Update data
        expect(mockQuery).toHaveBeenNthCalledWith(2, 
            expect.stringContaining("UPDATE presensi SET kehadiran = ?, waktu_presensi = ? WHERE id_presensi = ?"),
            ['Tidak Hadir', mockTimeString, idPresensi]
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Presensi diperbarui" }));
        expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    // E4: Insert/Update Failure (Server Error)
    test('E4: Seharusnya mengembalikan 500 jika query INSERT gagal', async () => {
        const res = mockRes();
        
        // Mock Query 1 (SELECT existing): return empty array
        mockQuery.mockResolvedValueOnce([[]]); 
        
        // Mock Query 2 (INSERT new): rejects
        mockQuery.mockRejectedValueOnce(new Error("DB Fatal Error"));
        
        const req = { body: { id_karyawan: idKaryawan, kehadiran: 'Hadir' } };
        await insertPresensi(req, res);
        
        expect(res.status).toHaveBeenCalledWith(500);
        expect(mockQuery).toHaveBeenCalledTimes(2);
    });
});

// ------------------------- EDIT PRESENSI TESTS -------------------------

describe('Presensi Edit Controller (Admin Override)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockClear();
    });

    // V2: Validasi Edit Input
    test('V2: Seharusnya 400 jika id_presensi atau kehadiran tidak diisi saat edit', async () => {
        const res = mockRes();
        const req = { body: { id_presensi: idPresensi } }; 
        await editPresensi(req, res);
        
        expect(res.status).toHaveBeenCalledWith(400);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    // T4: Edit Success
    test('T4: Seharusnya berhasil UPDATE kehadiran presensi berdasarkan id_presensi', async () => {
        const res = mockRes();
        const newKehadiran = 'Izin';
        
        // Mock Query: UPDATE (return affectedRows: 1)
        mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]); 
        
        const req = { body: { id_presensi: idPresensi, kehadiran: newKehadiran } };
        await editPresensi(req, res);
        
        expect(mockQuery).toHaveBeenCalledWith(
            "UPDATE presensi SET kehadiran = ? WHERE id_presensi = ?",
            [newKehadiran, idPresensi]
        );
        expect(res.status).toHaveBeenCalledWith(200);
    });

    // E5: Edit Not Found (404)
    test('E5: Seharusnya 404 jika id_presensi tidak ditemukan saat update', async () => {
        const res = mockRes();
        // Mock Query: UPDATE (return affectedRows: 0)
        mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }]); 
        
        const req = { body: { id_presensi: 999, kehadiran: 'Sakit' } };
        await editPresensi(req, res);
        
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Presensi tidak ditemukan" }));
    });
    
    // E6: Edit Failure (Server Error)
    test('E6: Seharusnya mengembalikan 500 jika query edit gagal', async () => {
        const res = mockRes();
        mockQuery.mockRejectedValueOnce(new Error("DB Error"));
        
        const req = { body: { id_presensi: idPresensi, kehadiran: 'Alpha' } };
        await editPresensi(req, res);
        
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Gagal memperbarui presensi" }));
    });
});