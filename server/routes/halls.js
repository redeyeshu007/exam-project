const express = require('express');
const router  = express.Router();
const Hall    = require('../models/Hall');
const { protect } = require('../middleware/auth');
const logger  = require('../logger');

// ── GET /api/halls ── list all
router.get('/', protect, async (req, res) => {
  try {
    const halls = await Hall.find().sort({ hallName: 1 });
    logger.info('Halls fetched', { count: halls.length, ip: req.ip });
    res.json(halls);
  } catch (err) {
    logger.error('Failed to fetch halls', { message: err.message });
    res.status(500).json({ message: 'Failed to load halls' });
  }
});

// ── POST /api/halls ── create
router.post('/', protect, async (req, res) => {
  try {
    const { hallName, capacity, rows, cols, smallBenchCount, bigBenchCount, smallBenchCap, bigBenchCap, block, notes } = req.body;
    if (!hallName || !hallName.trim()) return res.status(400).json({ message: 'Hall name is required' });

    const exists = await Hall.findOne({ hallName: hallName.trim() });
    if (exists) return res.status(409).json({ message: 'A hall with this name already exists' });

    const hall = await Hall.create({
      hallName: hallName.trim(),
      capacity:        capacity        ?? 30,
      rows:            rows            ?? 6,
      cols:            cols            ?? 5,
      smallBenchCount: smallBenchCount ?? 20,
      bigBenchCount:   bigBenchCount   ?? 10,
      smallBenchCap:   smallBenchCap   ?? 1,
      bigBenchCap:     bigBenchCap     ?? 2,
      block:           block           ?? 'CSE Block',
      notes:           notes           ?? '',
    });
    logger.info('Hall created', { hallName: hall.hallName, ip: req.ip });
    res.status(201).json(hall);
  } catch (err) {
    logger.error('Failed to create hall', { message: err.message });
    res.status(500).json({ message: 'Failed to create hall' });
  }
});

// ── PUT /api/halls/:id ── update
router.put('/:id', protect, async (req, res) => {
  try {
    const { hallName, capacity, rows, cols, smallBenchCount, bigBenchCount, smallBenchCap, bigBenchCap, block, notes } = req.body;
    if (!hallName || !hallName.trim()) return res.status(400).json({ message: 'Hall name is required' });

    const conflict = await Hall.findOne({ hallName: hallName.trim(), _id: { $ne: req.params.id } });
    if (conflict) return res.status(409).json({ message: 'Another hall with this name already exists' });

    const hall = await Hall.findByIdAndUpdate(
      req.params.id,
      { hallName: hallName.trim(), capacity, rows, cols, smallBenchCount, bigBenchCount, smallBenchCap, bigBenchCap, block, notes },
      { new: true, runValidators: true }
    );
    if (!hall) return res.status(404).json({ message: 'Hall not found' });
    logger.info('Hall updated', { hallName: hall.hallName, ip: req.ip });
    res.json(hall);
  } catch (err) {
    logger.error('Failed to update hall', { message: err.message });
    res.status(500).json({ message: 'Failed to update hall' });
  }
});

// ── DELETE /api/halls/:id ── delete
router.delete('/:id', protect, async (req, res) => {
  try {
    const hall = await Hall.findByIdAndDelete(req.params.id);
    if (!hall) return res.status(404).json({ message: 'Hall not found' });
    logger.info('Hall deleted', { hallName: hall.hallName, ip: req.ip });
    res.json({ message: 'Hall deleted successfully' });
  } catch (err) {
    logger.error('Failed to delete hall', { message: err.message });
    res.status(500).json({ message: 'Failed to delete hall' });
  }
});

module.exports = router;
