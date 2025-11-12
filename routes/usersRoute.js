import express from "express";
import {
  getAllUsers,
  createSuperAdmin,
  createAdmin,
  loginUser,
  deleteUser,
} from "../controllers/user_jntcargobeu004a.js";

import {
  getAllKaryawan,
  getKaryawanById,
  createKaryawan,
  editKaryawan,
  deleteKaryawan,
} from "../controllers/karyawan.js";

import {
  getAllDeliveryFee,
  insertDeliveryFee,
  editDeliveryFee,
  deleteDeliveryFee,
} from "../controllers/input_deliveryfee.js";

import {
  getAllDFOD,
  getDFODById,
  insertDFOD,
  editDFOD,
  deleteDFOD
} from "../controllers/input_dfod.js";

import {
  getAllPengeluaran,
  getPengeluaranById,
  insertPengeluaran,
  editPengeluaran,
  deletePengeluaran
} from "../controllers/input_pengeluaran.js";

import { getLaporanKeuangan } from "../controllers/laporan_keuangan.js";

import { logTodayInputs } from "../controllers/log_input_dashboard.js";

import {
  getAllPresensi,
  insertPresensi,
  editPresensi,
} from "../controllers/presensi.js";

import { verifyRole } from "../middleware/verifyRole.js";

const router = express.Router()

router.get("/superadmin", verifyRole(["Super Admin"]), getAllUsers);
router.post("/superadmin", createSuperAdmin);
router.post("/superadmin/tambah-admin", verifyRole(["Super Admin"]), createAdmin);
router.post("/login", loginUser);
router.delete("/superadmin", deleteUser);

router.get("/deliveryfee", verifyRole(["Super Admin", "Admin"]), getAllDeliveryFee);
router.post("/deliveryfee", verifyRole(["Super Admin", "Admin"]), insertDeliveryFee);
router.put("/deliveryfee", verifyRole(["Super Admin"]), editDeliveryFee);
router.delete("/deliveryfee", verifyRole(["Super Admin"]), deleteDeliveryFee);

router.get("/dfod", verifyRole(["Admin", "Super Admin"]), getAllDFOD);
router.get("/dfodbyid", verifyRole(["Admin", "Super Admin"]), getDFODById);
router.post("/dfod", verifyRole(["Admin", "Super Admin"]), insertDFOD);
router.put("/dfod", verifyRole(["Super Admin"]), editDFOD);
router.delete("/dfod", verifyRole(["Super Admin"]), deleteDFOD);

router.get("/pengeluaran", verifyRole(["Admin", "SuperAdmin"]), getAllPengeluaran);
router.get("/pengeluaranbyid", verifyRole(["Admin", "SuperAdmin"]), getPengeluaranById);
router.post("/pengeluaran", verifyRole(["Admin", "SuperAdmin"]), insertPengeluaran);
router.put("/pengeluaran", verifyRole(["SuperAdmin"]), editPengeluaran);
router.delete("/pengeluaran", verifyRole(["SuperAdmin"]), deletePengeluaran);

router.get("/laporan-keuangan", verifyRole(["SuperAdmin"]), getLaporanKeuangan);

router.get("/today", verifyRole(["Super Admin", "Admin"]), logTodayInputs);

router.get("/karyawan", verifyRole(["Super Admin"]), getAllKaryawan);
router.get("/karyawan/byid", verifyRole(["Super Admin"]), getKaryawanById);
router.post("/karyawan/create", verifyRole(["Super Admin"]), createKaryawan);
router.put("/karyawan/edit", verifyRole(["Super Admin"]), editKaryawan);
router.delete("/karyawan", verifyRole(["Super Admin"]), deleteKaryawan);

router.get("/", getAllPresensi);
router.post("/", insertPresensi);
router.put("/", verifyRole(["Super Admin"]), editPresensi);

// const deliveryFeeController = require('../controllers/input_deliveryfee');
// const dfodController = require('../controllers/input_dfod');
// const outgoingController = require('../controllers/input_outgoing');
// const pengeluaranController = require('../controllers/input_pengeluaran');
// const karyawanController = require('../controllers/karyawan');
// const laporanGajiController = require('../controllers/laporan_gaji');
// const logDashboardController = require('../controllers/log_input_dashboard');
// const manajemenGajiController = require('../controllers/manajemen_gaji');
// const presensiController = require('../controllers/presensi');

// router.get('/', dfodController.getAllDFOD);
// router.get('/:id', dfodController.getDFODById);
// router.post('/create', dfodController.createDFOD);
// router.put('/update/:id_input_dfod', dfodController.updateDFOD);
// router.delete('/delete/:id_input_dfod', dfodController.deleteDFOD);



// router.get('/outgoing', outgoingController.getAllOutgoing);
// router.get('/outgoing/:id', outgoingController.getOutgoingById);
// router.post('/outgoing', outgoingController.createOutgoing);
// router.put('/outgoing/:id', outgoingController.updateOutgoing);
// router.delete('/outgoing/:id', outgoingController.deleteOutgoing);





// router.get('/laporan-gaji', laporanGajiController.getAllLaporanGaji);
// router.get('/laporan-gaji/:id', laporanGajiController.getLaporanGajiById);
// router.post('/laporan-gaji', laporanGajiController.createLaporanGaji);
// router.put('/laporan-gaji/:id', laporanGajiController.updateLaporanGaji);
// router.delete('/laporan-gaji/:id', laporanGajiController.deleteLaporanGaji);


// router.get('/manajemen-gaji', manajemenGajiController.getAllManajemenGaji);
// router.post('/manajemen-gaji', manajemenGajiController.createManajemenGaji);
// router.put('/manajemen-gaji/:id', manajemenGajiController.updateManajemenGaji);
// router.delete('/manajemen-gaji/:id', manajemenGajiController.deleteManajemenGaji);

export default router;
