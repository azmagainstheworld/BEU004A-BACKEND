// verifyRole.js (Final: ignore case + spasi)
import jwt from "jsonwebtoken";

export const verifyRole = (allowedRoles = []) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log("[verifyRole] Token tidak ditemukan");
      return res.status(401).json({ message: "Token tidak ditemukan" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      console.log("[verifyRole] Token kosong setelah split");
      return res.status(401).json({ message: "Token tidak ditemukan" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.log("[verifyRole] Token tidak valid:", err.message);
        return res.status(401).json({ message: "Token tidak valid" });
      }

      console.log("[verifyRole] Decoded JWT:", decoded);

      // --- Normalisasi roles ---
      let userRoles = [];
      if (decoded.roles) {
        userRoles = Array.isArray(decoded.roles) ? decoded.roles : [decoded.roles];
      } else if (decoded.role) {
        userRoles = [decoded.role];
      }

      console.log("[verifyRole] Normalized userRoles:", userRoles);
      console.log("[verifyRole] Allowed roles for this route:", allowedRoles);

      // --- Hilangkan spasi + case-insensitive ---
      const isAllowed = allowedRoles.some(ar =>
        userRoles.some(ur =>
          ur.replace(/\s+/g, '').toLowerCase() === ar.replace(/\s+/g, '').toLowerCase()
        )
      );

      if (!isAllowed) {
        console.log("[verifyRole] Akses ditolak!");
        return res.status(403).json({
          message: `Akses ditolak: hanya ${allowedRoles.join(" / ")} yang diperbolehkan`,
        });
      }

      console.log("[verifyRole] Akses diterima. Lanjut ke controller.");
      req.user = { ...decoded, role: userRoles[0], roles: userRoles };
      next();
    });
  };
};
