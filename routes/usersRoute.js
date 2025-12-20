import express from "express";
import {
  getAllUsers,
  createSuperAdmin,
  createAdmin,
  loginUser,
  deleteUser,
  getTrashAdmin,
  restoreAdmin,
  deletePermanentAdmin,
} from "../controllers/user_jntcargobeu004a.js";

import {
  getAllKaryawan,
  getKaryawanById,
  createKaryawan,
  editKaryawan,
  deleteKaryawan,
  getTrashKaryawan,
  restoreKaryawan,
  deletePermanentKaryawan,
} from "../controllers/karyawan.js";

import {
  getAllDeliveryFee,
  insertDeliveryFee,
  editDeliveryFee,
  deleteDeliveryFee,
  restoreDeliveryFee,
  deletePermanentDeliveryFee,
  getTrashDeliveryFee,
} from "../controllers/input_deliveryfee.js";

import {
  getAllDFOD,
  insertDFOD,
  editDFOD,
  deleteDFOD,
  getTrashDFOD,
  restoreDFOD,
  deletePermanentDFOD
} from "../controllers/input_dfod.js";

import {
  getAllOutgoing,
  insertOutgoing,
  editOutgoing,
  deleteOutgoing, // Ini sekarang adalah Soft Delete
  getTrashOutgoing, // Baru
  restoreOutgoing, // Baru
  deletePermanentOutgoing // Baru
} from "../controllers/input_outgoing.js";

import {
  getAllPengeluaran,
  insertPengeluaran,
  editPengeluaran,
  deletePengeluaran, // Sekarang adalah Soft Delete
  getTrashPengeluaran, // BARU
  restorePengeluaran, // BARU
  deletePermanentPengeluaran // BARU
} from "../controllers/input_pengeluaran.js";

import {
  getAllManajemenGaji,
  saveManajemenGaji,
  getManajemenGajiById
} from "../controllers/manajemen_gaji.js";

import { getLaporanKeuangan } from "../controllers/laporan_keuangan.js";

import { logTodayInputs } from "../controllers/log_input_dashboard.js";

import {
  getAllPresensi,
  insertPresensi,
  editPresensi,
} from "../controllers/presensi.js";

import { getLaporanGaji } from '../controllers/laporan_gaji.js';

import { verifyRole } from "../middleware/verifyRole.js";

const router = express.Router()

router.get("/superadmin", verifyRole(["Super Admin"]), getAllUsers);
router.get("/superadmin/trash", verifyRole(["Super Admin"]), getTrashAdmin);
router.post("/superadmin", createSuperAdmin);
router.post("/superadmin/tambah-admin", verifyRole(["Super Admin"]), createAdmin);
router.post("/login", loginUser);
router.put("/superadmin/delete", deleteUser);
router.put("/superadmin/restore", restoreAdmin);
router.delete("/superadmin/delete-permanent", deletePermanentAdmin)


router.get("/deliveryfee", verifyRole(["Super Admin", "Admin"]), getAllDeliveryFee);
router.post("/deliveryfee", verifyRole(["Super Admin", "Admin"]), insertDeliveryFee);
router.put("/deliveryfee", verifyRole(["Super Admin"]), editDeliveryFee);
router.put("/deliveryfee/delete", verifyRole(["Super Admin"]), deleteDeliveryFee);
router.put("/deliveryfee/restore", verifyRole(["Super Admin"]), restoreDeliveryFee);
router.delete("/deliveryfee/delete-permanent", verifyRole(["Super Admin"]), deletePermanentDeliveryFee);
router.get("/deliveryfee/trash", verifyRole(["Super Admin"]), getTrashDeliveryFee);

router.get("/dfod", verifyRole(["Admin", "Super Admin"]), getAllDFOD);
router.post("/dfod", verifyRole(["Admin", "Super Admin"]), insertDFOD);
router.put("/dfod", verifyRole(["Super Admin"]), editDFOD);
router.put("/dfod/delete", verifyRole(["Super Admin"]), deleteDFOD);
router.get("/dfod/trash", verifyRole(["Super Admin"]), getTrashDFOD);
router.put("/dfod/restore", verifyRole(["Super Admin"]), restoreDFOD);
router.delete("/dfod/delete-permanent", verifyRole(["Super Admin"]), deletePermanentDFOD);


router.get("/outgoing", verifyRole(["Admin", "Super Admin"]), getAllOutgoing);
router.post("/outgoing/insert", verifyRole(["Admin", "Super Admin"]), insertOutgoing);
router.put("/outgoing", verifyRole(["Super Admin"]), editOutgoing);
router.put("/outgoing/delete", verifyRole(["Super Admin"]), deleteOutgoing); 
router.get("/outgoing/trash", verifyRole(["Super Admin"]), getTrashOutgoing);
router.put("/outgoing/restore", verifyRole(["Super Admin"]), restoreOutgoing);
router.delete("/outgoing/delete-permanent", verifyRole(["Super Admin"]), deletePermanentOutgoing)

router.get("/pengeluaran", verifyRole(["Admin", "Super Admin"]), getAllPengeluaran);
router.post("/pengeluaran", verifyRole(["Admin", "Super Admin"]), insertPengeluaran);
router.put("/pengeluaran", verifyRole(["Super Admin"]), editPengeluaran);
router.put("/pengeluaran/delete", verifyRole(["Super Admin"]), deletePengeluaran); 
router.get("/pengeluaran/trash", verifyRole(["Super Admin"]), getTrashPengeluaran);
router.put("/pengeluaran/restore", verifyRole(["Super Admin"]), restorePengeluaran);
router.delete("/pengeluaran/delete-permanent", verifyRole(["Super Admin"]), deletePermanentPengeluaran);

router.get("/laporan-keuangan", verifyRole(["Super Admin", "Admin"]), getLaporanKeuangan);

router.get("/today", verifyRole(["Super Admin", "Admin"]), logTodayInputs);


router.get("/karyawan", verifyRole(["Super Admin", "Admin"]), getAllKaryawan);
router.post("/karyawan/byid", verifyRole(["Super Admin", "Admin"]), getKaryawanById);
router.post("/karyawan/create", verifyRole(["Super Admin"]), createKaryawan);
router.put("/karyawan/edit", verifyRole(["Super Admin"]), editKaryawan);
router.put("/karyawan/delete", verifyRole(["Super Admin"]), deleteKaryawan);
router.get("/karyawan/trash", verifyRole(["Super Admin"]), getTrashKaryawan);
router.put("/karyawan/restore", verifyRole(["Super Admin"]), restoreKaryawan);
router.delete("/karyawan/delete-permanent", verifyRole(["Super Admin"]), deletePermanentKaryawan);


router.get("/manajemen-gaji", verifyRole(["Super Admin"]), getAllManajemenGaji);               // tanpa body (GET)
router.post("/manajemen-gaji", verifyRole(["Super Admin"]),  saveManajemenGaji);            // body
router.post("/manajemen-gaji-by-id", verifyRole(["Super Admin"]), getManajemenGajiById);      // body



router.get("/presensi", verifyRole(["Super Admin", "Admin"]), getAllPresensi);
router.post("/presensi", verifyRole(["Super Admin", "Admin"]), insertPresensi);
router.put("/presensi", verifyRole(["Super Admin"]), editPresensi);

router.get('/laporan-gaji', verifyRole(["Super Admin"]), getLaporanGaji);


export default router;
