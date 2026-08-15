const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
  email:     { type: String, default: 'cseexamcell2023@gmail.com' },
  password:  { type: String }, // bcrypt hashed
  name:      { type: String, default: 'Exam Cell Incharge' },
  otpCode:   { type: String },   // bcrypt-hashed OTP
  otpExpiry: { type: Date },
  // Login lockout tracking — cumulative across lockout cycles, only
  // reset by a successful login (see routes/auth.js).
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil:           { type: Date, default: null },
});

module.exports = mongoose.model('Admin', AdminSchema);
