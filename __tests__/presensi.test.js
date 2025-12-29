// __tests__/presensi.test.js

import { jest } from '@jest/globals'; 
import { 
    getAllPresensi, insertPresensi, editPresensi 
} from "../controllers/presensi.js";
import pool from "../config/dbconfig.js"; 

// ------------------------- MOCKING SECTION -------------------------

const mockRes = () => {
    const res = {};
    res.status = jest.fn(() => res); 
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

// MOCK Waktu WITA (Asia/Makassar) agar konsisten
const mockDateString = "2025-12-15"; 
const mockTimeString = "10:30:00"; 

global.Date = class MockDate extends Date {
    constructor() {
        super(mockDateString + 'T' + mockTimeString + '.000Z'); 
    }
    toLocaleDateString(locale, options) { return mockDateString; }
    toLocaleTimeString(locale, options) { return mockTimeString; }
};

// MOCK Pool.query global
const mockQuery = jest.fn();
pool.query = mockQuery; 

// Data Dummy
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

// ------------------------- TEST SUITES -------------------------

describe('Presensi Module - Unit Testing', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(async () => {
        try { if (pool.end) await pool.end(); } catch (e) {}
    });

    // --- 1. PENGUJIAN READ (GET ALL) ---
    describe('getAllPresensi', () => {
        test('R1: Harus mengambil semua data dengan JOIN karyawan (Admin/Super Admin)', async () => {
            const req = { user: { role: 'Admin' } };
            const res = mockRes();
            mockQuery.mockResolvedValueOnce([[dataPresensi]]);
            
            await getAllPresensi(req, res);
            
            // Verifikasi Query mengandung JOIN
            const query = mockQuery.mock.calls[0][0];
            expect(query).toMatch(/JOIN karyawan k/i);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([dataPresensi]));
        });

        test('A1: Harus memblokir jika role bukan Admin/Super Admin', async () => {
            const req = { user: { role: 'Karyawan' } };
            const res = mockRes();
            await getAllPresensi(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        });
    });

    // --- 2. PENGUJIAN INSERT (UPSERT LOGIC) ---
    describe('insertPresensi', () => {
        test('T1: INSERT baru jika belum ada presensi hari ini', async () => {
            const res = mockRes();
            const req = { 
                user: { role: 'Admin' }, 
                body: { id_karyawan: idKaryawan, kehadiran: 'Hadir' } 
            };
            
            mockQuery.mockResolvedValueOnce([[]]) // Belum ada data hari ini
                     .mockResolvedValueOnce([{ insertId: idPresensi }]); // Berhasil insert

            await insertPresensi(req, res);

            expect(mockQuery).toHaveBeenNthCalledWith(2, 
                expect.stringContaining("INSERT INTO presensi"),
                [idKaryawan, mockDateString, mockTimeString, 'Hadir']
            );
            expect(res.status).toHaveBeenCalledWith(201);
        });

        test('T2: UPDATE jika sudah ada presensi hari ini (Otomatis ganti status)', async () => {
            const res = mockRes();
            const req = { 
                user: { role: 'Admin' }, 
                body: { id_karyawan: idKaryawan, kehadiran: 'Izin' } 
            };
            
            mockQuery.mockResolvedValueOnce([[{ id_presensi: idPresensi }]]) // Sudah ada
                     .mockResolvedValueOnce([{ affectedRows: 1 }]);

            await insertPresensi(req, res);
            
            expect(mockQuery).toHaveBeenNthCalledWith(2, 
                expect.stringContaining("UPDATE presensi SET kehadiran = ?"),
                ['Izin', mockTimeString, idPresensi]
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Presensi diperbarui" }));
        });
    });

    // --- 3. PENGUJIAN EDIT (ADMIN OVERRIDE) ---
    describe('editPresensi', () => {
        test('T3: Sukses Update kehadiran berdasarkan ID (Super Admin Only)', async () => {
            const res = mockRes();
            const req = { 
                user: { role: 'Super Admin' }, 
                body: { id_presensi: idPresensi, kehadiran: 'Sakit' } 
            };
            
            mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]); 
            
            await editPresensi(req, res);
            
            expect(mockQuery).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE presensi SET kehadiran = ? WHERE id_presensi = ?"),
                ['Sakit', idPresensi]
            );
            expect(res.status).toHaveBeenCalledWith(200);
        });

        test('E1: Mengembalikan 404 jika id_presensi tidak ditemukan', async () => {
            const res = mockRes();
            const req = { user: { role: 'Super Admin' }, body: { id_presensi: 999, kehadiran: 'Hadir' } };
            mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }]); 
            
            await editPresensi(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Presensi tidak ditemukan" }));
        });
    });
});