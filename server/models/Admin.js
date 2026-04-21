const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
  email:     { type: String, default: 'cseexamcell2023@gmail.com' },
  password:  { type: String }, // bcrypt hashed
  name:      { type: String, default: 'Exam Cell Incharge' },
  otpCode:   { type: String },   // bcrypt-hashed OTP
  otpExpiry: { type: Date },
});

module.exports = mongoose.model('Admin', AdminSchema);
