import { jest } from '@jest/globals';
import { logTodayInputs } from "../controllers/log_input_dashboard.js";
import pool from "../config/dbconfig.js";

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnThis();
    res.json = jest.fn().mockReturnThis();
    return res;
};

const mockQuery = jest.fn();
pool.query = mockQuery;

describe('Log Input Dashboard - Unit Testing', () => {
    beforeEach(() => jest.clearAllMocks());
    afterAll(async () => { try { if (pool.end) await pool.end(); } catch (e) {} });

    test('D1: Mengirimkan parameter tanggal hari ini 4 kali ke query UNION', async () => {
        const res = mockRes();
        const req = { user: { roles: ['Admin'] } };
        mockQuery.mockResolvedValueOnce([[]]);
        await logTodayInputs(req, res);
        
        const params = mockQuery.mock.calls[0][1];
        expect(params.length).toBe(4);
        expect(params.every(p => typeof p === 'string')).toBe(true);
    });

    test('D2: Penanganan Error 500 jika query database gagal', async () => {
        const res = mockRes();
        const req = { user: { roles: ['Admin'] } };
        mockQuery.mockRejectedValueOnce(new Error("Query Error"));
        await logTodayInputs(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Query Error" }));
    });
});