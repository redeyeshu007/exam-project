const mongoose = require('mongoose');

const HallSchema = new mongoose.Schema({
  hallName:       { type: String, required: true, unique: true, trim: true },
  capacity:       { type: Number, default: 30 },
  rows:           { type: Number, default: 6 },
  cols:           { type: Number, default: 5 },
  smallBenchCount:{ type: Number, default: 20 },
  bigBenchCount:  { type: Number, default: 10 },
  smallBenchCap:  { type: Number, default: 1 },   // seats per small bench (can become 2 when overflow)
  bigBenchCap:    { type: Number, default: 2 },   // seats per big bench
  block:          { type: String, default: 'CSE Block', trim: true },
  notes:          { type: String, default: '', trim: true },
}, { timestamps: true });

module.exports = mongoose.model('Hall', HallSchema);
