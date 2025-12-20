import { jest } from '@jest/globals';n
import { checkResetToken, resetPassword } from "../controllers/auth.js";
import { verifyRole } from "../middleware/verifyRole.js";
// Asumsikan verifyToken ada di controllers/auth.js atau middleware/auth.js
import { verifyToken } from "../middleware/auth.js"; // JIKA path anda ke verifyToken adalah di sini
// Tambahkan import sendEmail dan crypto (Sesuaikan path jika perlu)
import crypto from "crypto";
import { sendEmail } from "../utils/sendEmail.js";
import { requestResetPassword } from "../controllers/auth.js"; 
import jwt from "jsonwebtoken"; // Import JWT hanya SATU KALI
import bcrypt from "bcrypt"; 
import pool from "../config/dbconfig.js"; 


// MOCK 4: CRYPTO
jest.mock("crypto", () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'mocked_reset_token'), // Mock generate token
  })),
}));

// MOCK 5: SENDEMAIL
jest.mock("../utils/sendEmail.js", () => ({
  sendEmail: jest.fn(),
}));

// MOCK 1: JWT (DIGABUNGKAN, Termasuk Kelas Error untuk verifyToken)
jest.mock("jsonwebtoken", () => {
    // Definisikan kelas Error agar instanceof bekerja di tes verifyToken
    class JsonWebTokenError extends Error {
        constructor(message) {
            super(message);
            this.name = 'JsonWebTokenError';
        }
    }
    class TokenExpiredError extends Error {
        constructor(message) {
            super(message);
            this.name = 'TokenExpiredError';
        }
    }
    
    return {
        verify: jest.fn(),
        JsonWebTokenError: JsonWebTokenError, 
        TokenExpiredError: TokenExpiredError,
        // Jika ada fungsi jwt lain yang Anda butuhkan (misal sign), tambahkan di sini
    };
});

// MOCK 2: BCRYPT
jest.mock("bcrypt", () => ({
    hash: jest.fn(),
}));

// MOCK 3: DB POOL
jest.mock("../config/dbconfig.js", () => ({
    query: jest.fn(),
}));

// 4. Definisikan test suite
describe('checkResetToken Controller', () => {
    // Bersihkan mock setelah setiap test selesai
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    // --- White-Box Test Case 1: Pengecekan Token Hilang ---
    test('P1: Seharusnya mengembalikan 400 jika token tidak ditemukan', async () => {
        // Mock request dan response objects
        const req = { query: {} }; // Req tanpa token di query
        const res = { 
            status: jest.fn(() => res), 
            json: jest.fn() 
        };

        await checkResetToken(req, res);

        // Assert/Verifikasi
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: "Token tidak ditemukan" });
        // Verifikasi bahwa pool.query TIDAK dipanggil (logika 'if' di awal berjalan)
        expect(pool.query).not.toHaveBeenCalled(); 
    });

    // --- White-Box Test Case 2: Pengecekan Token Tidak Valid/Kedaluwarsa ---
    test('P2: Seharusnya mengembalikan 400 jika token tidak valid atau expired', async () => {
        const tokenTidakValid = "invalid_expired_token";
        
        // Mock DB: membuat pool.query mengembalikan baris kosong (token tidak ditemukan)
        pool.query.mockResolvedValueOnce([[]]);

        const req = { query: { token: tokenTidakValid } };
        const res = { 
            status: jest.fn(() => res), 
            json: jest.fn() 
        };

        await checkResetToken(req, res);

        // Assert/Verifikasi
        expect(pool.query).toHaveBeenCalledWith(
          expect.any(String), // String SQL
          [tokenTidakValid]
        );
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: "Token tidak valid atau sudah kedaluwarsa" });
    });

    // --- White-Box Test Case 3: Pengecekan Token Valid (Sukses) ---
    test('P3: Seharusnya mengembalikan 200 jika token valid', async () => {
        const tokenValid = "valid_live_token";
        
        // Mock DB: membuat pool.query mengembalikan 1 baris (token ditemukan dan valid)
        pool.query.mockResolvedValueOnce([[{ id_user_jntcargobeu004a: 1 }]]);

        const req = { query: { token: tokenValid } };
        const res = { 
            status: jest.fn(() => res), 
            json: jest.fn() 
        };

        await checkResetToken(req, res);

        // Assert/Verifikasi
        // Status 200 (default) harus dipanggil/tidak dipanggil, tapi harus ada json
        expect(res.json).toHaveBeenCalledWith({ message: "Token valid" });
        // Pastikan DB dipanggil dengan token yang benar
        expect(pool.query).toHaveBeenCalledTimes(1);
    });
    
    // --- White-Box Test Case 4: Error Handling ---
    test('P4: Seharusnya mengembalikan 500 jika terjadi kesalahan server saat query DB', async () => {
        // Mock DB: membuat pool.query melempar error
        const mockError = new Error("Koneksi DB Gagal");
        pool.query.mockRejectedValue(mockError);

        const req = { query: { token: "any_token" } };
        const res = { 
            status: jest.fn(() => res), 
            json: jest.fn() 
        };

        await checkResetToken(req, res);

        // Assert/Verifikasi
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: "Terjadi kesalahan server" });
        expect(pool.query).toHaveBeenCalledTimes(1);
    });

});

describe('resetPassword Controller', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    // --- White-Box Test Case V1: Token Hilang ---
    test('V1: Seharusnya mengembalikan 400 jika token hilang', async () => {
        const req = { body: { newPassword: '123', confirmPassword: '123' } };
        const res = { status: jest.fn(() => res), json: jest.fn() };
        
        await resetPassword(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: "Token wajib diisi" });
        expect(pool.query).not.toHaveBeenCalled(); // Cek validasi jalur pendek
    });

    // --- White-Box Test Case V3: Password Tidak Cocok ---
    test('V3: Seharusnya mengembalikan 400 jika password tidak cocok', async () => {
        const req = { body: { 
            token: 'valid_token', 
            newPassword: 'a123', 
            confirmPassword: 'b456' 
        } };
        const res = { status: jest.fn(() => res), json: jest.fn() };
        
        await resetPassword(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: "Password dan konfirmasi tidak cocok" });
        expect(pool.query).not.toHaveBeenCalled(); 
    });
    
    // --- White-Box Test Case DB1: Token Invalid/Expired ---
    test('DB1: Seharusnya mengembalikan 400 jika token tidak valid/expired', async () => {
        // Mock DB: SELECT pertama (cek token) mengembalikan array kosong
        pool.query.mockResolvedValueOnce([[]]);
        
        const req = { body: { 
            token: 'expired_token', 
            newPassword: 'NewPassword123', 
            confirmPassword: 'NewPassword123' 
        } };
        const res = { status: jest.fn(() => res), json: jest.fn() };

        await resetPassword(req, res);

        expect(pool.query).toHaveBeenCalledTimes(1); // Hanya SELECT yang dipanggil
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: "Token tidak valid atau sudah kedaluwarsa" });
    });

    // --- White-Box Test Case DB2: Sukses (Full Path) ---
    test('DB2: Seharusnya mengembalikan 200 jika reset password berhasil', async () => {
        const userId = 101;
        const hashedPassword = 'hashed_new_password';

        // 1. Mock DB SELECT: Token ditemukan
        pool.query.mockResolvedValueOnce([[{ id_user_jntcargobeu004a: userId }]]);
        // 2. Mock bcrypt: Hash berhasil
        bcrypt.hash.mockResolvedValue(hashedPassword);
        // 3. Mock DB UPDATE: Berhasil
        pool.query.mockResolvedValueOnce([{}]);
        // 4. Mock DB DELETE: Berhasil
        pool.query.mockResolvedValueOnce([{}]);

        const req = { body: { 
            token: 'valid_token', 
            newPassword: 'NewPassword123', 
            confirmPassword: 'NewPassword123' 
        } };
        const res = { status: jest.fn(() => res), json: jest.fn() };

        await resetPassword(req, res);

        // Assert/Verifikasi alur:
        expect(pool.query).toHaveBeenCalledTimes(3); // SELECT, UPDATE, DELETE
        expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123', 10);
        
        // Cek bahwa UPDATE dipanggil dengan password dan user ID yang benar
        expect(pool.query).toHaveBeenNthCalledWith(2, 
            expect.stringContaining('UPDATE user_jntcargobeu004a'), 
            [hashedPassword, userId]
        );
        
        // Cek bahwa DELETE dipanggil
        expect(pool.query).toHaveBeenNthCalledWith(3, 
            expect.stringContaining('DELETE FROM reset_password_tokens'), 
            ['valid_token']
        );
        
        expect(res.json).toHaveBeenCalledWith({ message: "Password berhasil diubah" });
        expect(res.status).not.toHaveBeenCalledWith(400); // Pastikan tidak ada kegagalan
    });

    // --- White-Box Test Case DB3: Error Handling ---
    test('DB3: Seharusnya mengembalikan 500 jika terjadi error setelah token valid', async () => {
        const userId = 101;
        // 1. Mock DB SELECT: Token ditemukan (Agar melewati cek token)
        pool.query.mockResolvedValueOnce([[{ id_user_jntcargobeu004a: userId }]]);
        // 2. Mock bcrypt: Hash berhasil
        bcrypt.hash.mockResolvedValue('hashed_new_password');
        // 3. Mock DB UPDATE: GAGAL (Memaksa masuk ke catch)
        const mockError = new Error("Gagal Update Password");
        pool.query.mockRejectedValue(mockError); // Membuat query ke-2 (UPDATE) gagal

        const req = { body: { 
            token: 'valid_token', 
            newPassword: 'NewPassword123', 
            confirmPassword: 'NewPassword123' 
        } };
        const res = { status: jest.fn(() => res), json: jest.fn() };

        await resetPassword(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: "Terjadi kesalahan server" });
        // console.error (untuk mengecek di terminal output) akan dipanggil
    });
});

describe('verifyRole Middleware', () => {
    // Definisi allowedRoles yang akan digunakan untuk sebagian besar tes
    const allowedRoles = ["Admin", "Super Admin"];
    // Mock fungsi next() yang harus dipanggil jika middleware sukses
    const next = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });
    
    // --- White-Box Test Case P1: Header Tidak Ada ---
    test('P1: Seharusnya mengembalikan 401 jika header Authorization tidak ada', async () => {
        const req = { headers: {} };
        const res = { status: jest.fn(() => res), json: jest.fn() };
        
        verifyRole(allowedRoles)(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Token tidak ditemukan" });
        expect(jwt.verify).not.toHaveBeenCalled(); 
        expect(next).not.toHaveBeenCalled();
    });

    // --- White-Box Test Case P2: Token Kosong Setelah Split ---
    test('P2: Seharusnya mengembalikan 401 jika token kosong setelah Bearer', async () => {
        const req = { headers: { authorization: 'Bearer ' } };
        const res = { status: jest.fn(() => res), json: jest.fn() };
        
        verifyRole(allowedRoles)(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Token tidak ditemukan" });
        expect(jwt.verify).not.toHaveBeenCalled(); 
        expect(next).not.toHaveBeenCalled();
    });

    // --- White-Box Test Case P3: Token Tidak Valid (Gagal Verifikasi JWT) ---
    test('P3: Seharusnya mengembalikan 401 jika JWT gagal diverifikasi', async () => {
        const req = { headers: { authorization: 'Bearer invalidToken' } };
        const res = { status: jest.fn(() => res), json: jest.fn() };
        
        // Mock jwt.verify untuk mengembalikan error
        jwt.verify.mockImplementation((token, secret, callback) => {
            callback(new Error('JWT expired'), null);
        });

        verifyRole(allowedRoles)(req, res, next);

        expect(jwt.verify).toHaveBeenCalled(); 
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Token tidak valid" });
        expect(next).not.toHaveBeenCalled();
    });
    
    // --- White-Box Test Case P4: Akses Ditolak (Peran Salah) ---
    test('P4: Seharusnya mengembalikan 403 jika peran user tidak diizinkan', async () => {
        const req = { headers: { authorization: 'Bearer validToken' } };
        const res = { status: jest.fn(() => res), json: jest.fn() };
        
        // Mock jwt.verify untuk mengembalikan user dengan peran 'User Biasa'
        jwt.verify.mockImplementation((token, secret, callback) => {
            callback(null, { roles: ['User Biasa'] });
        });

        verifyRole(allowedRoles)(req, res, next); // allowedRoles = ["Admin", "Super Admin"]

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: expect.stringContaining("Akses ditolak") });
        expect(next).not.toHaveBeenCalled();
    });

    // --- White-Box Test Case P5: Akses Diterima (Peran Cocok) ---
    test('P5: Seharusnya memanggil next() jika peran user diizinkan', async () => {
        const req = { headers: { authorization: 'Bearer validToken' } };
        const res = { status: jest.fn(() => res), json: jest.fn() };
        const decodedUser = { userId: 1, roles: ['Admin'] };
        
        // Mock jwt.verify untuk mengembalikan user dengan peran 'Admin'
        jwt.verify.mockImplementation((token, secret, callback) => {
            callback(null, decodedUser);
        });

        verifyRole(allowedRoles)(req, res, next);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
        // Memastikan payload user ditambahkan ke req
        expect(req.user).toEqual({ ...decodedUser, roles: decodedUser.roles });
    });

    // --- White-Box Test Case P6: Case-Insensitive Match (Sukses) ---
    test('P6: Seharusnya memanggil next() jika peran cocok (case-insensitive & spasi)', async () => {
        const req = { headers: { authorization: 'Bearer validToken' } };
        const res = { status: jest.fn(() => res), json: jest.fn() };
        
        // Peran user mengandung spasi dan case berbeda
        jwt.verify.mockImplementation((token, secret, callback) => {
            callback(null, { roles: ['SUPER ADMIN'] });
        });

        verifyRole(["superadmin"])(req, res, next); // Peran diizinkan dalam lowercase

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });
});

describe('verifyToken Middleware', () => {
    // Mock fungsi next()
    const next = jest.fn();

    beforeEach(() => {
        // Membersihkan mock jwt.verify sebelum setiap tes
        jest.clearAllMocks();
    });

    // --- White-Box Test Case P1: Header Tidak Ada ---
    test('P1: Seharusnya mengembalikan 401 jika header Authorization tidak ada', () => {
        const req = { headers: {} };
        const res = { status: jest.fn(() => res), json: jest.fn() };
        
        verifyToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Silahkan Login Terlebih Dahulu" });
        expect(jwt.verify).not.toHaveBeenCalled(); 
        expect(next).not.toHaveBeenCalled();
    });

    // --- White-Box Test Case P2: Token Kosong ---
    test('P2: Seharusnya mengembalikan 401 jika token kosong setelah Bearer', () => {
        const req = { headers: { authorization: 'Bearer ' } };
        const res = { status: jest.fn(() => res), json: jest.fn() };
        
        verifyToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Silahkan Login Terlebih Dahulu" });
        expect(jwt.verify).not.toHaveBeenCalled(); 
        expect(next).not.toHaveBeenCalled();
    });
    
    // --- White-Box Test Case P3: Token Kedaluwarsa ---
    test('P3: Seharusnya mengembalikan 401 jika token kedaluwarsa', () => {
        const req = { headers: { authorization: 'Bearer expiredToken' } };
        const res = { status: jest.fn(() => res), json: jest.fn() };
        
        // Mock jwt.verify untuk mengembalikan TokenExpiredError
        jwt.verify.mockImplementation((token, secret, callback) => {
            callback(new jwt.TokenExpiredError('Expired'), null);
        });

        verifyToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Token kedaluwarsa, silahkan login ulang" });
        expect(next).not.toHaveBeenCalled();
    });

    // --- White-Box Test Case P4: Token Tidak Valid ---
    test('P4: Seharusnya mengembalikan 401 jika token tidak valid', () => {
        const req = { headers: { authorization: 'Bearer wrongSignature' } };
        const res = { status: jest.fn(() => res), json: jest.fn() };
        
        // Mock jwt.verify untuk mengembalikan JsonWebTokenError (Signature salah)
        jwt.verify.mockImplementation((token, secret, callback) => {
            callback(new jwt.JsonWebTokenError('Invalid signature'), null);
        });

        verifyToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: "Token tidak valid. Silahkan login ulang" });
        expect(next).not.toHaveBeenCalled();
    });

    // --- White-Box Test Case P5: Error Internal (Lainnya) ---
    test('P5: Seharusnya mengembalikan 500 jika terjadi error JWT non-standar', () => {
        const req = { headers: { authorization: 'Bearer errorToken' } };
        const res = { status: jest.fn(() => res), json: jest.fn() };
        
        // Mock jwt.verify untuk mengembalikan error non-standar
        const genericError = new Error('Database lookup failed');
        jwt.verify.mockImplementation((token, secret, callback) => {
            callback(genericError, null);
        });

        verifyToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: "Kesalahan pada internal server" });
        expect(next).not.toHaveBeenCalled();
    });

    // --- White-Box Test Case P6: Sukses ---
    test('P6: Seharusnya memanggil next() dan menyimpan decoded data jika token valid', () => {
        const req = { headers: { authorization: 'Bearer validToken' } };
        // res harus berupa object, dan res.locals harus bisa dimodifikasi
        const res = { locals: {}, status: jest.fn(() => res), json: jest.fn() }; 
        const decoded = { userId: 10, userEmail: 'test@mail.com', role: 'Admin' };
        
        // Mock jwt.verify untuk sukses
        jwt.verify.mockImplementation((token, secret, callback) => {
            callback(null, decoded);
        });

        verifyToken(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
        // Memastikan data tersimpan di res.locals
        expect(res.locals.userId).toBe(decoded.userId);
        expect(res.locals.userRole).toBe(decoded.role);
    });
});

describe('requestResetPassword Controller', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    const mockEmail = "test@example.com";
    const mockUserId = 50;

    // --- White-Box Test Case V1: Email Tidak Terdaftar ---
    test('V1: Seharusnya mengembalikan 404 jika email tidak terdaftar', async () => {
        // Mock DB: SELECT mengembalikan array kosong
        pool.query.mockResolvedValueOnce([[]]);

        const req = { body: { email: mockEmail } };
        const res = { status: jest.fn(() => res), json: jest.fn() };
        
        await requestResetPassword(req, res);

        expect(pool.query).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ message: "Email tidak terdaftar" });
        expect(sendEmail).not.toHaveBeenCalled(); 
    });

    // --- White-Box Test Case S1: Sukses Penuh ---
    test('S1: Seharusnya berhasil mengirim link reset password', async () => {
        // 1. Mock DB SELECT: Email ditemukan
        pool.query.mockResolvedValueOnce([[{ id_user_jntcargobeu004a: mockUserId, email: mockEmail }]]);
        // 2. Mock DB INSERT: Token berhasil disimpan
        pool.query.mockResolvedValueOnce([{}]);
        // 3. Mock sendEmail: Berhasil
        sendEmail.mockResolvedValue(true);

        const req = { body: { email: mockEmail } };
        const res = { status: jest.fn(() => res), json: jest.fn() };
        
        await requestResetPassword(req, res);

        expect(pool.query).toHaveBeenCalledTimes(2); // SELECT dan INSERT
        expect(crypto.randomBytes).toHaveBeenCalled();
        expect(sendEmail).toHaveBeenCalledTimes(1);
        
        // Verifikasi bahwa sendEmail dipanggil dengan token yang benar
        const emailArgs = sendEmail.mock.calls[0];
        expect(emailArgs[0]).toBe(mockEmail);
        expect(emailArgs[2]).toContain('mocked_reset_token'); 

        expect(res.json).toHaveBeenCalledWith({ message: "Link reset password telah dikirim ke email" });
    });

    // --- White-Box Test Case E1: Error Server (DB Gagal INSERT) ---
    test('E1: Seharusnya mengembalikan 500 jika terjadi kesalahan saat menyimpan token', async () => {
        // 1. Mock DB SELECT: Email ditemukan
        pool.query.mockResolvedValueOnce([[{ id_user_jntcargobeu004a: mockUserId, email: mockEmail }]]);
        // 2. Mock DB INSERT: GAGAL
        const mockError = new Error("DB Connection Failed during Insert");
        pool.query.mockRejectedValue(mockError); 

        const req = { body: { email: mockEmail } };
        const res = { status: jest.fn(() => res), json: jest.fn() };
        
        await requestResetPassword(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: "Terjadi kesalahan server" });
        expect(sendEmail).not.toHaveBeenCalled(); 
    });
});