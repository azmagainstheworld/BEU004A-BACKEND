import express from "express";
import { verifyRole } from "../middleware/verifyRole.js";
import {
  requestResetPassword,
  validateResetToken,
  resetPassword,
  changeOwnPassword,
  changeOtherPassword
} from "../controllers/auth.js";

const router = express.Router();

router.post("/request-reset-password", requestResetPassword);

router.get("/validate-reset-token", validateResetToken);

router.post("/reset-password", resetPassword);

router.put("/change-password", verifyRole(["Admin", "Super Admin"]), changeOwnPassword);

router.put("superadmin/change-password", verifyRole(["Super Admin"]), changeOtherPassword);

export default router;
