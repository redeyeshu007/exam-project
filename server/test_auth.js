const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const Admin = require('./models/Admin');

dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const admins = await Admin.find({});
  console.log("Found admins:", admins.length);
  if (admins.length > 0) {
    const admin = admins[0];
    console.log("DB Email:", `"${admin.email}"`);
    console.log("DB Password Hash:", admin.password);
    
    const emailMatch = admin.email === 'cseexamcell2023@gmail.com';
    console.log("Email 'cseexamcell2023@gmail.com' matches DB?", emailMatch);
    
    const isMatch = await bcrypt.compare('psna@admin2025', admin.password);
    console.log("Password matches hash?", isMatch);
  } else {
    console.log("No admins found in DB!!!");
  }
  process.exit(0);
}).catch(console.error);
