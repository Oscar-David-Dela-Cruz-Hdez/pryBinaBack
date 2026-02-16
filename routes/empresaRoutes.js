const express = require("express");
const { getEmpresa, updateEmpresa } = require("../controllers/empresaController");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

router.get("/", getEmpresa);
router.put("/", authMiddleware(["admin"]), updateEmpresa);

module.exports = router;
