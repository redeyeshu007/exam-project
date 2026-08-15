require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Admin = require('./models/Admin');

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const salt = await bcrypt.genSalt(10);
  const hp = await bcrypt.hash(adminPassword, salt);
  await Admin.updateOne({ email: adminEmail }, { password: hp }, { upsert: true });
  console.log(`Password force-updated for ${adminEmail}`);
  process.exit(0);
}).catch(console.error);
