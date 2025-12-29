// __tests__/dfod.test.js
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// 1. Setup Mock untuk Database Connection
const mockConn = {
  beginTransaction: jest.fn().mockResolvedValue(true),
  query: jest.fn(),
  commit: jest.fn().mockResolvedValue(true),
  rollback: jest.fn().mockResolvedValue(true),
  release: jest.fn().mockReturnValue(true),
};

const mockGetConnection = jest.fn().mockResolvedValue(mockConn);
const mockPoolQuery = jest.fn();

// 2. Mocking Module dbconfig.js secara Unstable (Gaya ESM Jest)
jest.unstable_mockModule('../config/dbconfig.js', () => ({
  default: {
    getConnection: mockGetConnection,
    query: mockPoolQuery
  }
}));

// Import controller setelah mock didefinisikan
const { 
  insertDFOD, getAllDFOD, editDFOD, 
  deleteDFOD, restoreDFOD, deletePermanentDFOD 
} = await import('../controllers/input_dfod.js');

describe('Full Suite Unit Testing - DFOD System', () => {

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnThis();
    res.json = jest.fn().mockReturnThis();
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===============================================
  // 1. TESTING GET ALL DFOD
  // ===============================================
  describe('getAllDFOD', () => {
    it('harus mengembalikan semua data jika Super Admin', async () => {
      const req = { user: { roles: ['Super Admin'] } };
      const res = mockRes();
      mockPoolQuery.mockResolvedValueOnce([[{ id_input_dfod: 1 }]]);

      await getAllDFOD(req, res);

      expect(mockPoolQuery).toHaveBeenCalledWith(expect.stringContaining("SELECT * FROM input_dfod"));
      expect(res.json).toHaveBeenCalled();
    });

    it('harus memfilter berdasarkan tanggal jika Admin biasa', async () => {
      const req = { user: { roles: ['Admin'] } };
      const res = mockRes();
      mockPoolQuery.mockResolvedValueOnce([[]]);

      await getAllDFOD(req, res);

      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining("AND DATE(tanggal_dfod) = ?"), 
        expect.anything()
      );
    });
  });

  // ===============================================
  // 2. TESTING INSERT DFOD
  // ===============================================
  describe('insertDFOD', () => {
    it('harus memicu Error 403 jika user tidak memiliki role yang diizinkan', async () => {
      const req = { user: { roles: ['User'] }, body: {} };
      const res = mockRes();

      await insertDFOD(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("Akses ditolak") }));
    });

    it('harus rollback dan return 400 jika nominal < 1000', async () => {
      const req = { 
        user: { roles: ['Admin'] }, 
        body: { nominal: "500", jenis_pembayaran: "Cash" } 
      };
      const res = mockRes();

      await insertDFOD(req, res);

      expect(mockConn.rollback).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('harus sukses menjalankan transaksi lengkap (DFOD, Laporan, Log)', async () => {
      const req = { 
        user: { roles: ['Super Admin'] }, 
        body: { nominal: "15.000", jenis_pembayaran: "Cash" } 
      };
      const res = mockRes();

      // Mock sequence query: 1. Insert DFOD, 2. Kas, 3. JFS, 4. Log
      mockConn.query.mockResolvedValueOnce([{ insertId: 99 }]) // DFOD
                   .mockResolvedValueOnce([{}])                 // Laporan Kas
                   .mockResolvedValueOnce([{}])                 // Laporan JFS
                   .mockResolvedValueOnce([{}]);                // Dashboard Log

      await insertDFOD(req, res);

      expect(mockConn.beginTransaction).toHaveBeenCalled();
      expect(mockConn.commit).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ===============================================
  // 3. TESTING EDIT DFOD
  // ===============================================
  describe('editDFOD', () => {
    it('harus menolak akses jika bukan Super Admin (Check req.user.role)', async () => {
      const req = { user: { role: 'Admin' }, body: {} };
      const res = mockRes();

      await editDFOD(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('harus menghapus laporan lama dan membuat yang baru saat update', async () => {
      const req = { 
        user: { role: 'Super Admin' }, 
        body: { id_input_dfod: 1, nominal: "20.000", jenis_pembayaran: "Transfer" } 
      };
      const res = mockRes();

      // Mock sequence: 1. SELECT old, 2. UPDATE DFOD, 3-4. DELETE old finance, 5-6. INSERT new, 7-8. Log
      mockConn.query.mockResolvedValueOnce([[{ id_input_dfod: 1, nominal: 10000, jenis_pembayaran: "Cash" }]])
                   .mockResolvedValue([{}]);

      await editDFOD(req, res);

      expect(mockConn.commit).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("updated") }));
    });
  });

  // ===============================================
  // 4. TESTING SOFT DELETE DFOD
  // ===============================================
  describe('deleteDFOD', () => {
    it('harus mengubah status jadi deleted dan menghapus laporan keuangan terkait', async () => {
      const req = { user: { role: 'Super Admin' }, body: { id_input_dfod: 1 } };
      const res = mockRes();

      mockConn.query.mockResolvedValueOnce([[{ tanggal_dfod: '2025-01-01', nominal: 5000, jenis_pembayaran: 'Cash' }]])
                   .mockResolvedValue([{}]);

      await deleteDFOD(req, res);

      expect(mockConn.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE input_dfod SET status = 'deleted'"), expect.anything());
      expect(mockConn.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM laporan_keuangan"), expect.anything());
      expect(mockConn.commit).toHaveBeenCalled();
    });
  });

  // ===============================================
  // 5. TESTING RESTORE & PERMANENT
  // ===============================================
  describe('Lifecycle Trash', () => {
    it('harus memulihkan data dan memasukkan kembali ke laporan keuangan', async () => {
      const req = { user: { role: 'Super Admin' }, body: { id_input_dfod: 1 } };
      const res = mockRes();

      mockConn.query.mockResolvedValueOnce([[{ nominal: 5000, jenis_pembayaran: 'Cash' }]])
                   .mockResolvedValue([{}]);

      await restoreDFOD(req, res);

      expect(mockConn.query).toHaveBeenCalledWith(expect.stringContaining("active"), expect.anything());
      expect(mockConn.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO laporan_keuangan"), expect.anything());
    });

    it('harus menghapus data secara fisik dari database pada deletePermanent', async () => {
      const req = { user: { role: 'Super Admin' }, body: { id_input_dfod: 1 } };
      const res = mockRes();

      mockConn.query.mockResolvedValueOnce([[{ nominal: 5000, jenis_pembayaran: 'Cash' }]])
                   .mockResolvedValue([{}]);

      await deletePermanentDFOD(req, res);

      expect(mockConn.query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM input_dfod"), expect.anything());
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});