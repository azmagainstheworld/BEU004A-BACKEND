// __tests__/auth.test.js
import { jest } from '@jest/globals';

// --- PERBAIKAN: Letakkan mock di paling atas untuk memblokir inisialisasi Resend ---
jest.mock("../utils/sendEmail.js", () => ({
    sendEmail: jest.fn().mockResolvedValue(true)
}));

jest.mock("bcrypt", () => ({
    hash: jest.fn().mockResolvedValue("hashed_password_123"),
    compare: jest.fn().mockResolvedValue(true)
}));

jest.mock("crypto", () => ({
    randomBytes: jest.fn(() => ({
        toString: jest.fn(() => 'mocked_reset_token_123')
    }))
}));

// Baru import controller dan modul lainnya setelah mocking
import { 
    requestResetPassword, resetPassword, 
    changeOwnPassword, changeOtherPassword 
} from "../controllers/auth.js";
import pool from "../config/dbconfig.js";
import { sendEmail } from "../utils/sendEmail.js";

const mockRes = () => {
    const res = {};
    res.status = jest.fn(() => res); 
    res.json = jest.fn().mockReturnValue(res);
    res.locals = {};
    return res;
};

const mockQuery = jest.fn();
pool.query = mockQuery;

describe('Auth Module - Unit Testing (Fixed)', () => {
    beforeEach(() => { jest.clearAllMocks(); });

    // Jalur: Berhasil kirim email
    test('R1: requestResetPassword - Harus berhasil memicu sendEmail', async () => {
        const req = { body: { email: 'test@jnt.com' } };
        const res = mockRes();
        mockQuery.mockResolvedValueOnce([[{ id_user_jntcargobeu004a: 1, email: 'test@jnt.com' }]]) // SELECT
                 .mockResolvedValueOnce([{}]); // INSERT Token
        
        await requestResetPassword(req, res);
        expect(sendEmail).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("dikirim") }));
    });

    // Jalur: Proteksi Role Super Admin
    describe('changeOtherPassword Protections', () => {
        test('SA1: Super Admin diizinkan mengubah password user lain', async () => {
            const req = { 
                user: { role: 'Super Admin' },
                body: { targetUserId: 5, newPassword: '123', confirmPassword: '123' } 
            };
            const res = mockRes();
            mockQuery.mockResolvedValueOnce([[{ id_user_jntcargobeu004a: 5 }]]).mockResolvedValueOnce([{}]);
            
            await changeOtherPassword(req, res);
            expect(res.json).toHaveBeenCalledWith({ message: "Password user berhasil diubah oleh Super Admin" });
        });

        test('SA2: Admin ditolak mengubah password user lain (403)', async () => {
            const req = { user: { role: 'Admin' }, body: { targetUserId: 5 } };
            const res = mockRes();
            await changeOtherPassword(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        });
    });
});