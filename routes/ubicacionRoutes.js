const express = require("express");
const { getUbicacion, updateUbicacion } = require("../controllers/ubicacionController");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

router.get("/", getUbicacion);
router.put("/", authMiddleware(["admin"]), updateUbicacion);

module.exports = router;
