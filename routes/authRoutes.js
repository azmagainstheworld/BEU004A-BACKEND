import express from "express";
import { verifyRole } from "../middleware/verifyRole.js";
import { verifyToken } from "../middleware/auth.js";
import {
  requestResetPassword,
  // validateResetToken,
  resetPassword,
  changeOwnPassword,
  checkResetToken,
  changeOtherPassword
} from "../controllers/auth.js";

const router = express.Router();

router.post("/request-reset-password", requestResetPassword);

// router.get("/validate-reset-token/:token", validateResetToken);

router.get("/check-reset-token", checkResetToken);

router.post("/reset-password", resetPassword);

router.put("/change-password", verifyToken, verifyRole(["Admin", "Super Admin"]), changeOwnPassword);

router.put("/superadmin/change-password", verifyRole(["Super Admin"]), changeOtherPassword);

export default router;
