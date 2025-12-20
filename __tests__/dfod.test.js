import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// 1. MOCK HARUS DI ATAS IMPORT TARGET
// Kita buat mock function di luar agar bisa diakses
const mockGetConnection = jest.fn();

jest.unstable_mockModule('../config/dbconfig.js', () => ({
  default: {
    getConnection: mockGetConnection,
    query: jest.fn()
  }
}));

// 2. Import module setelah mock (Gunakan dynamic import jika perlu, 
// atau biarkan Jest menangani hoisting unstable_mockModule)
const { insertDFOD } = await import('../controllers/dfodController.js');
const { default: pool } = await import('../config/dbconfig.js');

describe('White Box Testing - insertDFOD (Internal Logic)', () => {
  let mockConn;

  beforeEach(() => {
    // 3. Reset state koneksi setiap test
    mockConn = {
      beginTransaction: jest.fn().mockResolvedValue(true),
      query: jest.fn(),
      commit: jest.fn().mockResolvedValue(true),
      rollback: jest.fn().mockResolvedValue(true),
      release: jest.fn().mockReturnValue(true),
    };
    
    // Pastikan ini adalah fungsi mock yang benar
    mockGetConnection.mockResolvedValue(mockConn);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('harus memicu Error 400 jika jenis_pembayaran kosong (Validation Branch)', async () => {
    const req = { body: { nominal: "5000", jenis_pembayaran: "" } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await insertDFOD(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Jenis pembayaran wajib diisi" }));
  });

  it('harus rollback dan return 400 jika nominal < 1000 (Boundary Value Analysis)', async () => {
    const req = { body: { nominal: "500", jenis_pembayaran: "Cash" } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await insertDFOD(req, res);

    expect(mockConn.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('harus menjalankan seluruh transaksi sampai commit jika data valid', async () => {
    const req = { body: { nominal: "10.000", jenis_pembayaran: "Cash" } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    // Mock hasil query insertId
    mockConn.query.mockResolvedValueOnce([{ insertId: 1 }]); 
    // Mock query sisanya (Laporan Keuangan & Log)
    mockConn.query.mockResolvedValue([{}]); 

    await insertDFOD(req, res);

    expect(mockConn.beginTransaction).toHaveBeenCalled();
    expect(mockConn.commit).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('harus melakukan rollback jika terjadi kegagalan query SQL (Error Handling)', async () => {
    const req = { body: { nominal: "10.000", jenis_pembayaran: "Cash" } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    mockConn.query.mockRejectedValueOnce(new Error("Database Crash"));

    await insertDFOD(req, res);

    expect(mockConn.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});