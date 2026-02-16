const express = require("express");
const { getMision, updateMision } = require("../controllers/misionController");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

router.get("/", getMision);
router.put("/", authMiddleware(["admin"]), updateMision);

module.exports = router;
