const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Admin = require('./models/Admin');

const MONGODB_URI = 'mongodb+srv://csepsna:csepsna%402026@cluster0.envobg5.mongodb.net/ehall';

mongoose.connect(MONGODB_URI).then(async () => {
  const salt = await bcrypt.genSalt(10);
  const hp = await bcrypt.hash('psna@admin2025', salt);
  await Admin.updateOne({ email: 'cseexamcell2023@gmail.com' }, { password: hp }, { upsert: true });
  console.log("PASSWORD FORCE UPDATED TO: psna@admin2025");
  process.exit(0);
}).catch(console.error);
