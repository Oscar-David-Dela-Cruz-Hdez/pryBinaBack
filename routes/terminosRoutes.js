const express = require("express");
const { getTerminos, updateTerminos } = require("../controllers/terminosController");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

router.get("/", getTerminos);
router.put("/", authMiddleware(["admin"]), updateTerminos);

module.exports = router;
