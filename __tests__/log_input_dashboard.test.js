// __tests__/log_input_dashboard.test.js

import { jest } from '@jest/globals'; 
import { logTodayInputs } from "../controllers/log_input_dashboard.js"; 
import pool from "../config/dbconfig.js"; 

// ------------------------- MOCKING SECTION -------------------------

// Tanggal hari ini yang di-mock
const mockTodayStr = "2025-12-15"; // YYYY-MM-DD
const mockYear = 2025;
const mockMonth = 11; // Month Index (December)
const mockDay = 15;

// MOCK GLOBAL DATE (untuk memastikan todayStr di Controller selalu '2025-12-15')
global.Date = class MockDate extends Date {
    constructor() {
        // Harus mengembalikan tanggal yang konsisten
        super(mockYear, mockMonth, mockDay); 
    }
    getFullYear() { return mockYear; }
    getMonth() { return mockMonth; }
    getDate() { return mockDay; }
};


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

// Data Mock Gabungan (untuk sukses)
const mockDataGabungan = [
    { 
        id_log_input_dashboard: 401, jenis: 'Pengeluaran', nominal: 50000, 
        tanggal: mockTodayStr, jenis_pembayaran: 'Cash', jenis_pengeluaran: 'Kasbon', 
        nama_karyawan: 'Karyawan A', deskripsi: 'Untuk makan siang' 
    },
    { 
        id_log_input_dashboard: 402, jenis: 'DFOD', nominal: 100000, 
        tanggal: mockTodayStr, jenis_pembayaran: 'Transfer', jenis_pengeluaran: '-', 
        nama_karyawan: '-', deskripsi: '-' 
    },
    { 
        id_log_input_dashboard: 403, jenis: 'Delivery Fee', nominal: 15000, 
        tanggal: mockTodayStr, jenis_pembayaran: '-', jenis_pengeluaran: '-', 
        nama_karyawan: '-', deskripsi: '-' 
    },
];

// ------------------------- LOG TODAY INPUTS TESTS -------------------------

describe('Log Input Dashboard Controller', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockClear();
    });

    // T1: Sukses Mengambil Data Gabungan Hari Ini (FINAL FIX)
    test('T1: Seharusnya menggabungkan data dari 4 tabel yang aktif pada hari ini', async () => {
        const res = mockRes();
        
        // Mock Query: Mengembalikan data gabungan
        mockQuery.mockResolvedValueOnce([mockDataGabungan]);

        const req = {};
        await logTodayInputs(req, res);

        // Verifikasi 1: Query dipanggil 1 kali
        expect(mockQuery).toHaveBeenCalledTimes(1);
        
        // Verifikasi 3: Parameter tanggal dikirim 4 kali dan nilainya benar
        const queryParams = mockQuery.mock.calls[0][1];
        expect(queryParams).toEqual([mockTodayStr, mockTodayStr, mockTodayStr, mockTodayStr]);
        
        // Verifikasi 4: Response Data
        // Ini adalah assertion kunci. Jika data benar, Controller SUKSES (status implisit 200).
        expect(res.json).toHaveBeenCalledWith(mockDataGabungan); 
        
        // Verifikasi Status Error (Cara teraman untuk read-only controller)
        expect(res.status).not.toHaveBeenCalledWith(500);
    });
    
    // T2: Memastikan Query Pengeluaran mengandung JOIN Karyawan
    test('T2: Query Pengeluaran harus mengandung LEFT JOIN karyawan', async () => {
        const res = mockRes();
        mockQuery.mockResolvedValueOnce([[]]); 

        const req = {};
        await logTodayInputs(req, res);

        const sqlQuery = mockQuery.mock.calls[0][0];
        
        // Pola Regex untuk memastikan bagian Pengeluaran mengandung JOIN
        const pengeluaranQueryRegex = /FROM log_input_dashboard l.*JOIN input_pengeluaran p.*LEFT JOIN karyawan k ON p\.id_karyawan = k\.id_karyawan/s;
        
        expect(sqlQuery).toMatch(pengeluaranQueryRegex);
    });

    // E1: Gagal Fetch (Server Error)
    test('E1: Seharusnya 500 jika query SQL gagal tereksekusi', async () => {
        const res = mockRes();
        
        // Mock Query: Rejects
        mockQuery.mockRejectedValueOnce(new Error("Database Connection Lost")); 

        const req = {};
        await logTodayInputs(req, res);

        expect(mockQuery).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(500);
        // Pastikan pesan error yang dikembalikan sesuai dengan yang dilempar dari catch block
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Database Connection Lost" }));
    });
});