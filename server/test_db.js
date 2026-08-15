const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Admin = require('./models/Admin');

dotenv.config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const admins = await Admin.find({});
  console.log("Admins active:", admins.length);
  if(admins.length > 0) {
    console.log("Email:", admins[0].email);
    console.log("Password Hash:", admins[0].password);
  }
  process.exit(0);
}).catch(console.error);
