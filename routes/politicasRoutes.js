const express = require("express");
const { getPoliticas, updatePoliticas } = require("../controllers/politicasController");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

router.get("/", getPoliticas);
router.put("/", authMiddleware(["admin"]), updatePoliticas);

module.exports = router;
