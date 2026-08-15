const mongoose = require('mongoose');

const DraftSchema = new mongoose.Schema({
  allocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Allocation', required: true, unique: true },
  editableShts: { type: mongoose.Schema.Types.Mixed, default: [] },
  textBoxes: { type: mongoose.Schema.Types.Mixed, default: [] },
  timetableData: { type: mongoose.Schema.Types.Mixed, default: [] },
  savedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Draft', DraftSchema);
