const mongoose = require('mongoose');

const AllocationSchema = new mongoose.Schema({
  examName: String,
  academicYear: { type: String, required: true },
  year: { type: String, required: true },
  semester: { type: String, required: true },
  semesterType: { type: String, required: true },
  yearSemester: { type: String, required: true },
  session: String,
  sessionTime: String,
  fromDate: Date,
  toDate: Date,
  block: String,
  sections: [{
    name: String,
    strength: Number
  }],
  totalStrength: Number,
  hallAllocations: [{
    hallName: String,
    totalInHall: Number,
    entries: [{
      section: String,
      fromRoll: Number,
      toRoll: Number,
      count: Number
    }]
  }],
  // Elective fields (3rd/4th year)
  hasElectives: { type: Boolean, default: false },
  studentData: [{
    rollNumber: String,
    studentName: String,
    section: String,
    elective: String,
    electives: [String],
    // Separate "Roll No" column value, when the Excel also has a distinct
    // Register Number column. Drives ordering for both seat/bench
    // assignment and the Attendance Sheet — Register Number itself is
    // never used to determine order, only ever printed as a value.
    rollNo: String
  }],
  electiveSubjects: [String],
  sectionElectiveCounts: { type: mongoose.Schema.Types.Mixed, default: null },
  hallSubjectCounts: { type: mongoose.Schema.Types.Mixed, default: null },
  seatBlocks: { type: mongoose.Schema.Types.Mixed, default: null },
  validationReport: { type: mongoose.Schema.Types.Mixed, default: null },
  seatingChart: [{
    hallName: String,
    capacity: Number,
    filled: Number,
    totalStudents: Number,
    seats: [{
      seatNumber: Number,
      rollNumber: String,
      studentName: String,
      section: String,
      elective: String,
      electives: [String],
      year: String,
      displayLabel: String,
      sno: Number,
      benchId: String,
      benchType: String,
      seatIndex: Number,
    }]
  }],
  layoutBased: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Allocation', AllocationSchema);
