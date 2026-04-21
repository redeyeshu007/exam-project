const express = require('express');
const router = express.Router();
const Allocation = require('../models/Allocation');
const { protect } = require('../middleware/auth');
const logger = require('../logger');

// GET /api/allocations
router.get('/', protect, async (req, res) => {
  try {
    const allocations = await Allocation.find().sort({ createdAt: -1 }).select('-studentData -seatingChart -seatBlocks');
    logger.info('Allocations list fetched', { count: allocations.length, ip: req.ip });
    res.json(allocations);
  } catch (error) {
    logger.error('Failed to fetch allocations', { message: error.message, stack: error.stack });
    res.status(500).json({ message: 'Failed to load allocations' });
  }
});

// GET /api/allocations/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const allocation = await Allocation.findById(req.params.id);
    if (!allocation) {
      logger.warn('Allocation not found', { id: req.params.id, ip: req.ip });
      return res.status(404).json({ message: 'Allocation not found' });
    }
    logger.info('Allocation fetched', { id: req.params.id, ip: req.ip });
    res.json(allocation);
  } catch (error) {
    logger.error('Failed to fetch allocation', { id: req.params.id, message: error.message, stack: error.stack });
    res.status(500).json({ message: 'Failed to load allocation' });
  }
});

// PATCH /api/allocations/:id  — edit basic metadata fields only
router.patch('/:id', protect, async (req, res) => {
  try {
    const allowed = ['examName', 'academicYear', 'year', 'semester', 'semesterType',
                     'yearSemester', 'session', 'sessionTime', 'fromDate', 'toDate', 'block'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const allocation = await Allocation.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!allocation) {
      logger.warn('Allocation patch — not found', { id: req.params.id, ip: req.ip });
      return res.status(404).json({ message: 'Allocation not found' });
    }
    logger.info('Allocation updated', { id: req.params.id, fields: Object.keys(updates), ip: req.ip });
    res.json(allocation);
  } catch (error) {
    logger.error('Failed to update allocation', { id: req.params.id, message: error.message, stack: error.stack });
    res.status(500).json({ message: 'Failed to update allocation' });
  }
});

// DELETE /api/allocations/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const allocation = await Allocation.findById(req.params.id);
    if (!allocation) {
      return res.status(404).json({ message: 'Allocation not found' });
    }
    await allocation.deleteOne();
    logger.info('Allocation deleted', { id: req.params.id, ip: req.ip });
    res.json({ message: 'Allocation removed' });
  } catch (error) {
    logger.error('Failed to delete allocation', { id: req.params.id, message: error.message, stack: error.stack });
    res.status(500).json({ message: 'Failed to delete allocation' });
  }
});

// POST /api/allocations
router.post('/', protect, async (req, res) => {
  try {
    const {
      examName, academicYear, year, semester, semesterType, yearSemester,
      session, sessionTime, fromDate, toDate, block, sections, totalStrength,
      halls, hasElectives, studentData, electiveSubjects, sectionElectiveCounts
    } = req.body;

    if (hasElectives && studentData && studentData.length > 0) {
      // ==========================================
      // ELECTIVE ALLOCATION (3rd/4th Year)
      // Students have electives[] array (multiple elective groups)
      // ==========================================
      const allStudents = [...studentData];
      // Use electiveSubjects from client (canonical, header-order). Only fall back to
      // deriving from student data if not provided — preserving insertion order, not sorted.
      const electives = (electiveSubjects && electiveSubjects.length > 0)
        ? electiveSubjects
        : [...new Set(allStudents.flatMap(s => s.electives || [s.elective]))];

      // Sort students by section (A→D) then by rollNumber within each section
      const sectionNames = [...new Set(allStudents.map(s => s.section))].sort();
      const sortedStudents = [...allStudents].sort((a, b) => {
        if (a.section < b.section) return -1;
        if (a.section > b.section) return 1;
        return String(a.rollNumber).localeCompare(String(b.rollNumber));
      });

      // Assign per-section sequential S.No (1-based, resets for each section)
      const sectionSNoCursor = {};
      sortedStudents.forEach(s => {
        if (!sectionSNoCursor[s.section]) sectionSNoCursor[s.section] = 0;
        sectionSNoCursor[s.section]++;
        s._sno = sectionSNoCursor[s.section];
      });

      // Allocate sequentially: fill each hall in order, section by section
      let studentIndex = 0;
      const hallAllocationsResult = [];
      const hallSubjectCounts = {};

      for (const hall of halls) {
        const capacity = parseInt(hall.capacity);
        const studentsForHall = sortedStudents.slice(studentIndex, studentIndex + capacity);
        studentIndex += studentsForHall.length;

        // Group by section — preserve sorted order within each section
        const hallSections = {};
        studentsForHall.forEach(s => {
          if (!hallSections[s.section]) hallSections[s.section] = [];
          hallSections[s.section].push(s);
        });

        // Each entry: section + per-section S.No range + count
        const hallEntries = Object.keys(hallSections).sort().map(sec => {
          const secStudents = hallSections[sec];
          return {
            section: sec,
            fromRoll: secStudents[0]._sno,
            toRoll: secStudents[secStudents.length - 1]._sno,
            count: secStudents.length
          };
        });

        hallAllocationsResult.push({
          hallName: hall.hallName,
          totalInHall: studentsForHall.length,
          entries: hallEntries
        });

        // Count elective papers per hall
        hallSubjectCounts[hall.hallName] = {};
        electives.forEach(el => { hallSubjectCounts[hall.hallName][el] = 0; });
        studentsForHall.forEach(s => {
          (s.electives || [s.elective]).forEach(el => {
            if (hallSubjectCounts[hall.hallName][el] !== undefined) {
              hallSubjectCounts[hall.hallName][el]++;
            }
          });
        });
      }

      // Compute section-wise elective counts from actual student data
      const computedSectionCounts = {};
      sectionNames.forEach(sec => {
        computedSectionCounts[sec] = {};
        electives.forEach(el => { computedSectionCounts[sec][el] = 0; });
      });
      allStudents.forEach(s => {
        (s.electives || [s.elective]).forEach(el => {
          if (computedSectionCounts[s.section] && computedSectionCounts[s.section][el] !== undefined) {
            computedSectionCounts[s.section][el]++;
          }
        });
      });

      // ---- Build seating chart (seat-wise per hall) ----
      const seatingChart = [];
      let seatStudentIdx = 0;
      for (const hall of halls) {
        const capacity = parseInt(hall.capacity);
        const studentsForHall = sortedStudents.slice(seatStudentIdx, seatStudentIdx + capacity);
        seatStudentIdx += studentsForHall.length;
        seatingChart.push({
          hallName: hall.hallName,
          capacity: capacity,
          filled: studentsForHall.length,
          seats: studentsForHall.map((s, i) => ({
            seatNumber: i + 1,
            rollNumber: s.rollNumber,
            studentName: s.studentName,
            section: s.section,
            elective: (s.electives && s.electives[0]) || s.elective || '',
            electives: s.electives || [s.elective]
          }))
        });
      }

      // ---- Build seat blocks (chunks of 25) with subject counts ----
      const seatBlocks = {};
      const BLOCK_SIZE = 25;
      seatingChart.forEach(hallChart => {
        const blocks = [];
        for (let i = 0; i < hallChart.seats.length; i += BLOCK_SIZE) {
          const chunk = hallChart.seats.slice(i, i + BLOCK_SIZE);
          const blockSubjects = {};
          electives.forEach(el => { blockSubjects[el] = 0; });
          chunk.forEach(seat => {
            (seat.electives || [seat.elective]).forEach(el => {
              if (blockSubjects[el] !== undefined) blockSubjects[el]++;
            });
          });
          blocks.push({
            from: i + 1,
            to: i + chunk.length,
            total: chunk.length,
            subjects: blockSubjects
          });
        }
        seatBlocks[hallChart.hallName] = blocks;
      });

      // ---- Build validation report ----
      // Compare expected totals (sum of section counts) vs allocated totals (sum of hall counts)
      const expectedTotals = {};
      electives.forEach(el => {
        expectedTotals[el] = sectionNames.reduce((sum, sec) => {
          return sum + ((computedSectionCounts[sec] || {})[el] || 0);
        }, 0);
      });
      const allocatedTotals = {};
      electives.forEach(el => {
        allocatedTotals[el] = Object.keys(hallSubjectCounts).reduce((sum, hall) => {
          return sum + ((hallSubjectCounts[hall] || {})[el] || 0);
        }, 0);
      });
      const validationReport = {};
      electives.forEach(el => {
        const expected = expectedTotals[el];
        const allocated = allocatedTotals[el];
        const diff = expected - allocated;
        validationReport[el] = {
          expected,
          allocated,
          difference: diff,
          status: diff === 0 ? 'match' : (diff > 0 ? 'missing' : 'extra')
        };
      });

      const newAllocation = new Allocation({
        examName, academicYear, year, semester, semesterType, yearSemester,
        session, sessionTime, fromDate, toDate, block, sections, totalStrength,
        hasElectives: true,
        studentData: allStudents,
        electiveSubjects: electives,
        sectionElectiveCounts: computedSectionCounts,
        hallSubjectCounts: hallSubjectCounts,
        hallAllocations: hallAllocationsResult,
        seatingChart: seatingChart,
        seatBlocks: seatBlocks,
        validationReport: validationReport
      });

      await newAllocation.save();
      logger.info('Elective allocation created', {
        id: newAllocation._id, examName, yearSemester, totalStrength, halls: halls.map(h => h.hallName), ip: req.ip
      });
      res.status(201).json(newAllocation);

    } else {
      // ==========================================
      // STANDARD ALLOCATION (1st/2nd Year)
      // ==========================================
      let currentSection = 0;
      let currentRoll = 1;
      let allocationResult = [];

      for (const hall of halls) {
        let remainingCapacity = hall.capacity;
        let hallEntries = [];
        
        while (remainingCapacity > 0 && currentSection < sections.length) {
          const section = sections[currentSection];
          const maxRollForSection = section.strength;
          const studentsAvailable = maxRollForSection - currentRoll + 1;
          const studentsToFill = Math.min(remainingCapacity, studentsAvailable);
          
          hallEntries.push({
            section: section.name,
            fromRoll: currentRoll,
            toRoll: currentRoll + studentsToFill - 1
          });
          
          currentRoll += studentsToFill;
          remainingCapacity -= studentsToFill;
          
          if (currentRoll > maxRollForSection) {
            currentSection++;
            currentRoll = 1;
          }
        }
        
        allocationResult.push({
          hallName: hall.hallName,
          totalInHall: hall.capacity - remainingCapacity,
          entries: hallEntries
        });
      }

      const newAllocation = new Allocation({
        examName, academicYear, year, semester, semesterType, yearSemester,
        session, sessionTime, fromDate, toDate, block, sections, totalStrength,
        hasElectives: false,
        hallAllocations: allocationResult
      });
      
      await newAllocation.save();
      logger.info('Standard allocation created', {
        id: newAllocation._id, examName, yearSemester, totalStrength, halls: halls.map(h => h.hallName), ip: req.ip
      });
      res.status(201).json(newAllocation);
    }
  } catch (error) {
    logger.error('Allocation creation failed', { message: error.message, stack: error.stack, ip: req.ip });
    res.status(500).json({ message: 'Allocation failed. Please try again.' });
  }
});

module.exports = router;
