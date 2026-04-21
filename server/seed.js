const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const Admin = require('./models/Admin');
const Hall = require('./models/Hall');
const connectDB = require('./config/db');

dotenv.config();

connectDB();

const defaultHalls = [
  { hallName: 'CS104' }, { hallName: 'CS105' }, { hallName: 'CS201' }, { hallName: 'CS202' },
  { hallName: 'CS205' }, { hallName: 'CS206' }, { hallName: 'CS208' }, { hallName: 'CS209' },
  { hallName: 'CS210' }, { hallName: 'CS211' }, { hallName: 'CS301' }, { hallName: 'CS302' },
  { hallName: 'CS305' }, { hallName: 'CS306' }, { hallName: 'CS308' }, { hallName: 'CS309' },
  { hallName: 'CS310' }, { hallName: 'CS311' }, { hallName: 'CS313' }, { hallName: 'CS314' },
  { hallName: 'GF LAB' }, { hallName: 'FF LAB' }, { hallName: 'SF LAB' }
];

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

    await Hall.insertMany(defaultHalls);

    console.log('Data Imported!');
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

importData();
