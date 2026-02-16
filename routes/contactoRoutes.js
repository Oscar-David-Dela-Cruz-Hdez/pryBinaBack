const express = require("express");
const { getContactos, createContacto, updateContacto, deleteContacto } = require("../controllers/contactoController");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

router.get("/", getContactos);
router.post("/", authMiddleware(["admin"]), createContacto);
router.put("/:id", authMiddleware(["admin"]), updateContacto);
router.delete("/:id", authMiddleware(["admin"]), deleteContacto);

module.exports = router;
