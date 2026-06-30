const express = require('express');
const router = express.Router();
const multer = require('multer');
const packageController = require('../controllers/packageController');

// Store files safely in RAM as a Buffer object during processing
const upload = multer({ storage: multer.memoryStorage() });

// Unified endpoint for your team apps to consume
router.post('/', upload.single('document'), packageController.createSignatureTransaction);

module.exports = router;