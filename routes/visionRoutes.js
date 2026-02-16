const express = require("express");
const { getVision, updateVision } = require("../controllers/visionController");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

router.get("/", getVision);
router.put("/", authMiddleware(["admin"]), updateVision);

module.exports = router;
