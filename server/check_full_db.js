const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Admin = require('./models/Admin');
const Hall = require('./models/Hall');
const Allocation = require('./models/Allocation');

dotenv.config();

const checkDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const admins = await Admin.find({});
        const halls = await Hall.find({});
        const allocations = await Allocation.find({});
        
        console.log('--- DB SUMMARY ---');
        console.log('Admins count:', admins.length);
        console.log('Halls count:', halls.length);
        console.log('Allocations count:', allocations.length);
        
        if (admins.length > 0) {
            console.log('Admins:', JSON.stringify(admins, null, 2));
        }
        
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkDB();
