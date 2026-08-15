const mongoose = require('mongoose');

const BenchSchema = new mongoose.Schema({
  id:    { type: String, required: true },
  row:   { type: Number, required: true },
  col:   { type: Number, required: true },
  type:  { type: String, enum: ['SB', 'BB'], required: true },
  label: { type: String, default: '' },
}, { _id: false });

const HallLayoutSchema = new mongoose.Schema({
  hallName:   { type: String, required: true, unique: true },
  rows:       { type: Number, required: true, min: 1, max: 30 },
  cols:       { type: Number, required: true, min: 1, max: 20 },
  benches:    [BenchSchema],
  totalSeats: { type: Number, default: 0 },
  updatedAt:  { type: Date, default: Date.now },
});

module.exports = mongoose.model('HallLayout', HallLayoutSchema);
