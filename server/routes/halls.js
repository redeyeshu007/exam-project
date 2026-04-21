const express = require('express');
const router = express.Router();
const Hall = require('../models/Hall');
const { protect } = require('../middleware/auth');
const logger = require('../logger');

// GET /api/halls
router.get('/', protect, async (req, res) => {
  try {
    const halls = await Hall.find().sort({ hallName: 1 });
    logger.info('Halls fetched', { count: halls.length, ip: req.ip });
    res.json(halls);
  } catch (error) {
    logger.error('Failed to fetch halls', { message: error.message, stack: error.stack });
    res.status(500).json({ message: 'Failed to load halls' });
  }
});

module.exports = router;
