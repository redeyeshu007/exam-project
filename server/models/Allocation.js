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
    electives: [String]
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
    seats: [{
      seatNumber: Number,
      rollNumber: String,
      studentName: String,
      section: String,
      elective: String,
      electives: [String]
    }]
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Allocation', AllocationSchema);
