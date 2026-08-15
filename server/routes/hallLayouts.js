const express = require('express');
const router = express.Router();
const HallLayout = require('../models/HallLayout');
const { protect } = require('../middleware/auth');
const logger = require('../logger');

// GET /api/hall-layouts — list all (summary only)
router.get('/', protect, async (req, res) => {
  try {
    const layouts = await HallLayout.find({}, 'hallName rows cols totalSeats updatedAt').sort({ hallName: 1 });
    res.json(layouts);
  } catch (err) {
    logger.error('Failed to fetch hall layouts', { message: err.message });
    res.status(500).json({ message: 'Failed to load hall layouts' });
  }
});

// GET /api/hall-layouts/:hallName — full layout with benches
router.get('/:hallName', protect, async (req, res) => {
  try {
    const layout = await HallLayout.findOne({ hallName: req.params.hallName });
    if (!layout) return res.status(404).json({ message: 'No layout found for this hall' });
    res.json(layout);
  } catch (err) {
    logger.error('Failed to fetch hall layout', { message: err.message, hall: req.params.hallName });
    res.status(500).json({ message: 'Failed to load hall layout' });
  }
});

// PUT /api/hall-layouts/:hallName — create or replace (upsert)
router.put('/:hallName', protect, async (req, res) => {
  try {
    const { rows, cols, benches } = req.body;
    if (!rows || !cols) return res.status(400).json({ message: 'rows and cols are required' });

    const totalSeats = (benches || []).reduce((sum, b) => sum + (b.type === 'BB' ? 2 : 1), 0);

    const layout = await HallLayout.findOneAndUpdate(
      { hallName: req.params.hallName },
      { hallName: req.params.hallName, rows, cols, benches: benches || [], totalSeats, updatedAt: new Date() },
      { upsert: true, new: true, runValidators: true }
    );

    logger.info('Hall layout saved', { hallName: req.params.hallName, benches: (benches || []).length, totalSeats });
    res.json(layout);
  } catch (err) {
    logger.error('Failed to save hall layout', { message: err.message, hall: req.params.hallName });
    res.status(500).json({ message: 'Failed to save hall layout' });
  }
});

// DELETE /api/hall-layouts/:hallName
router.delete('/:hallName', protect, async (req, res) => {
  try {
    const deleted = await HallLayout.findOneAndDelete({ hallName: req.params.hallName });
    if (!deleted) return res.status(404).json({ message: 'No layout found for this hall' });
    logger.info('Hall layout deleted', { hallName: req.params.hallName });
    res.json({ message: 'Layout deleted successfully' });
  } catch (err) {
    logger.error('Failed to delete hall layout', { message: err.message, hall: req.params.hallName });
    res.status(500).json({ message: 'Failed to delete hall layout' });
  }
});

module.exports = router;
