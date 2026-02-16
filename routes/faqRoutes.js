const express = require("express");
const { getFaqs, createFaq, updateFaq, deleteFaq } = require("../controllers/faqController");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

router.get("/", getFaqs);
router.post("/", authMiddleware(["admin"]), createFaq);
router.put("/:id", authMiddleware(["admin"]), updateFaq);
router.delete("/:id", authMiddleware(["admin"]), deleteFaq);

module.exports = router;
