const express = require('express');
const router = express.Router();
const alexaController = require('../controllers/alexaController');

// El endpoint POST para Alexa
router.post('/', alexaController.adapter.getRequestHandlers());

module.exports = router;
