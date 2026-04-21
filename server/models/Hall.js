const mongoose = require('mongoose');

const HallSchema = new mongoose.Schema({
  hallName: { type: String, required: true, unique: true }
});

module.exports = mongoose.model('Hall', HallSchema);
