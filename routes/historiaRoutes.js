const express = require("express");
const { getHistoria, updateHistoria } = require("../controllers/historiaController");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

router.get("/", getHistoria);
router.put("/", authMiddleware(["admin"]), updateHistoria);

module.exports = router;
