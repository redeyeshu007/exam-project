const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const Admin = require('./models/Admin');
const Hall = require('./models/Hall');
const connectDB = require('./config/db');

dotenv.config();

connectDB();

const importData = async () => {
  try {
    await Admin.deleteMany();
    await Hall.deleteMany();

    const salt = await bcrypt.genSalt(10);
    const passwordString = (process.env.ADMIN_PASSWORD || 'psna@admin2025').trim();
    const hashedPassword = await bcrypt.hash(passwordString, salt);
    
    await Admin.create({
      email: (process.env.ADMIN_EMAIL || 'admin@psna.ac.in').trim(),
      password: hashedPassword
    });

    console.log('Data Imported!');
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

importData();
