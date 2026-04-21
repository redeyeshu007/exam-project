const express = require('express');
const router = express.Router();
const Draft = require('../models/Draft');
const { protect } = require('../middleware/auth');
const logger = require('../logger');

// GET /api/drafts/:allocationId — load draft for an allocation
router.get('/:allocationId', protect, async (req, res) => {
  try {
    const draft = await Draft.findOne({ allocationId: req.params.allocationId });
    if (!draft) return res.status(404).json({ message: 'No draft found' });
    res.json(draft);
  } catch (error) {
    logger.error('Failed to load draft', { message: error.message, stack: error.stack });
    res.status(500).json({ message: 'Failed to load draft' });
  }
});

// PUT /api/drafts/:allocationId — save/update draft (upsert)
router.put('/:allocationId', protect, async (req, res) => {
  try {
    const { editableShts, textBoxes, timetableData } = req.body;
    const draft = await Draft.findOneAndUpdate(
      { allocationId: req.params.allocationId },
      {
        allocationId: req.params.allocationId,
        editableShts: editableShts || [],
        textBoxes: textBoxes || [],
        timetableData: timetableData || [],
        savedAt: new Date(),
      },
      { upsert: true, new: true, runValidators: true }
    );
    logger.info('Draft saved', { allocationId: req.params.allocationId, ip: req.ip });
    res.json(draft);
  } catch (error) {
    logger.error('Failed to save draft', { message: error.message, stack: error.stack });
    res.status(500).json({ message: 'Failed to save draft' });
  }
});

// DELETE /api/drafts/:allocationId — discard draft
router.delete('/:allocationId', protect, async (req, res) => {
  try {
    await Draft.findOneAndDelete({ allocationId: req.params.allocationId });
    logger.info('Draft deleted', { allocationId: req.params.allocationId, ip: req.ip });
    res.json({ message: 'Draft removed' });
  } catch (error) {
    logger.error('Failed to delete draft', { message: error.message, stack: error.stack });
    res.status(500).json({ message: 'Failed to delete draft' });
  }
});

module.exports = router;
