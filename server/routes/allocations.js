const express = require('express');
const router = express.Router();
const Allocation = require('../models/Allocation');
const HallLayout = require('../models/HallLayout');
const { protect } = require('../middleware/auth');
const logger = require('../logger');
const { allocateSeatsToLayout } = require('../utils/seatAllocator');

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
// If this allocation was seated together with others (same hall + session +
// overlapping dates, seating already generated at least once), those
// siblings' seatingChart still has this allocation's students baked in as a
// frozen snapshot — regenerate their seating right after the delete so the
// deleted year's students disappear from their Hall Plan, Seating Chart, and
// Attendance sheet instead of lingering as stale data.
router.delete('/:id', protect, async (req, res) => {
  try {
    const allocation = await Allocation.findById(req.params.id);
    if (!allocation) {
      return res.status(404).json({ message: 'Allocation not found' });
    }

    const others = await Allocation.find({ _id: { $ne: allocation._id }, layoutBased: true });
    const siblingIds = others
      .filter(o => sharesGroupWith(allocation, o))
      .map(o => o._id);

    await allocation.deleteOne();
    logger.info('Allocation deleted', { id: req.params.id, ip: req.ip });

    if (siblingIds.length > 0) {
      await regenerateSeating(siblingIds);
      logger.info('Sibling seating regenerated after delete', {
        deletedId: req.params.id, siblingIds, ip: req.ip
      });
    }

    res.json({ message: 'Allocation removed', regeneratedSiblings: siblingIds.length });
  } catch (error) {
    logger.error('Failed to delete allocation', { id: req.params.id, message: error.message, stack: error.stack });
    res.status(500).json({ message: 'Failed to delete allocation' });
  }
});

// POST /api/allocations
router.post('/', protect, async (req, res) => {
  try {
    let {
      examName, academicYear, year, semester, semesterType, yearSemester,
      session, sessionTime, fromDate, toDate, block, sections, totalStrength,
      halls, hasElectives, studentData, electiveSubjects, sectionElectiveCounts
    } = req.body;

    if ((!year || !semester) && yearSemester) {
      const parts = yearSemester.split('/');
      if (parts.length === 2) {
        year = year || parts[0].trim();
        semester = semester || parts[1].trim();
      }
    }


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

      // Sort students by section (A→D). Within a section, order by Roll No
      // when the Excel had a separate Roll No column (distinct from
      // Register Number) — checked per-section since it's only trustworthy
      // when every student in that section actually has one. Do NOT sort
      // by Register Number itself — register numbers are not always
      // sequential (some students have non-standard reg numbers like
      // 2302... or 23039**11**... that would sort before 23039**21**...
      // even though they appear later in the Excel sheet); sections
      // without a separate Roll No column instead keep original Excel row
      // order (Array.sort is stable in Node).
      const sectionNames = [...new Set(allStudents.map(s => s.section))].sort();
      const sectionsWithRollNo = new Set(
        sectionNames.filter(sec => {
          const inSection = allStudents.filter(s => s.section === sec);
          return inSection.length > 0 && inSection.every(s => s.rollNo);
        })
      );
      const sortedStudents = [...allStudents].sort((a, b) => {
        if (a.section < b.section) return -1;
        if (a.section > b.section) return 1;
        if (sectionsWithRollNo.has(a.section)) {
          const an = Number(a.rollNo), bn = Number(b.rollNo);
          if (!isNaN(an) && !isNaN(bn)) return an - bn;
          return String(a.rollNo).localeCompare(String(b.rollNo));
        }
        return 0; // preserve original Excel insertion order within each section
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
            sno: s._sno,
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

// Generate layout-based seating for one or more allocations sharing the same
// exam date/hall. Detects multi-year conflicts automatically and mixes
// students with anti-copying rules. Shared by the /seating route and by the
// delete cascade below (regenerating a group's seating after one member is
// removed, so no deleted allocation's students linger in a sibling's chart).
async function regenerateSeating(allocationIds) {
  const allocations = await Allocation.find({ _id: { $in: allocationIds } });
  if (allocations.length === 0) {
    return { hallsProcessed: 0, missingLayouts: [] };
  }

  // Collect all unique hall names across selected allocations
  const hallNameSet = new Set();
  allocations.forEach(alloc => {
    (alloc.hallAllocations || []).forEach(ha => hallNameSet.add(ha.hallName));
  });
  const allHallNames = [...hallNameSet];

  // Load HallLayout for each hall (may be missing)
  const layoutMap = {};
  const missingLayouts = [];
  await Promise.all(allHallNames.map(async (hallName) => {
    const layout = await HallLayout.findOne({ hallName });
    if (layout) {
      layoutMap[hallName] = layout;
    } else {
      missingLayouts.push(hallName);
    }
  }));

  // Build hall → pooled students map across all allocations
  const hallStudentMap = {};
  allHallNames.forEach(hn => { hallStudentMap[hn] = []; });

  for (const alloc of allocations) {
    const yearLabel = alloc.year || 'I';

    if (alloc.hasElectives && alloc.studentData && alloc.studentData.length > 0) {
      // Elective allocation: use seatingChart seats to know which students go to which hall
      (alloc.seatingChart || []).forEach(hallChart => {
        if (!hallStudentMap[hallChart.hallName]) hallStudentMap[hallChart.hallName] = [];
        hallChart.seats.forEach(seat => {
          hallStudentMap[hallChart.hallName].push({
            rollNumber: seat.rollNumber,
            studentName: seat.studentName,
            section: seat.section,
            year: yearLabel,
            elective: seat.elective || '',
            electives: seat.electives || [],
            sno: seat.sno || seat.seatNumber,
          });
        });
      });
    } else {
      // Standard allocation: reconstruct students from hallAllocations entries
      (alloc.hallAllocations || []).forEach(ha => {
        if (!hallStudentMap[ha.hallName]) hallStudentMap[ha.hallName] = [];
        (ha.entries || []).forEach(entry => {
          for (let roll = entry.fromRoll; roll <= entry.toRoll; roll++) {
            hallStudentMap[ha.hallName].push({
              rollNumber: String(roll),
              studentName: '',
              section: entry.section,
              year: yearLabel,
              elective: '',
              electives: [],
              sno: roll,
            });
          }
        });
      });
    }
  }

  // Run seating algorithm per hall and update each allocation's seatingChart
  const hallSeatingResults = {};
  for (const hallName of allHallNames) {
    const students = hallStudentMap[hallName] || [];
    const layout = layoutMap[hallName];
    const benches = layout ? layout.benches : null;

    const result = allocateSeatsToLayout(benches, students, hallName);
    hallSeatingResults[hallName] = result;
  }

  // Update all involved allocations with new seating data
  for (const alloc of allocations) {
    const yearLabel = alloc.year || 'I';
    const updatedSeatingChart = [];

    const hallsForAlloc = [...new Set((alloc.hallAllocations || []).map(ha => ha.hallName))];
    for (const hallName of hallsForAlloc) {
      const result = hallSeatingResults[hallName];
      if (!result) continue;

      const layout = layoutMap[hallName];
      // Count only this year's students for the "filled" field (used in hall plan print)
      const thisYearCount = result.seats.filter(s => s.year === yearLabel).length;

      // Store ALL students (all years combined) so the seating chart print
      // shows the complete mixed hall — each seat object has a 'year' field
      updatedSeatingChart.push({
        hallName,
        capacity: layout ? layout.totalSeats : result.seats.length,
        filled: thisYearCount,
        totalStudents: result.seats.length,
        seats: result.seats,
      });
    }

    await Allocation.findByIdAndUpdate(alloc._id, {
      $set: { seatingChart: updatedSeatingChart, layoutBased: true }
    });
  }

  return { hallsProcessed: allHallNames.length, missingLayouts };
}

// Two allocations were seated together if they share a hall, the same
// session, and overlapping exam dates — the same condition the client uses
// to badge them as a matching pair in the Seating Allotment list.
function datesOverlap(a, b) {
  if (!a.fromDate || !a.toDate || !b.fromDate || !b.toDate) return false;
  return new Date(a.fromDate) <= new Date(b.toDate) && new Date(b.fromDate) <= new Date(a.toDate);
}
function sharesGroupWith(a, b) {
  if (!a.session || !b.session || a.session !== b.session) return false;
  if (!datesOverlap(a, b)) return false;
  const hallsA = (a.hallAllocations || []).map(ha => ha.hallName);
  const hallsB = (b.hallAllocations || []).map(ha => ha.hallName);
  return hallsA.some(h => hallsB.includes(h));
}

// POST /api/allocations/seating
router.post('/seating', protect, async (req, res) => {
  try {
    const { allocationIds } = req.body;

    if (!allocationIds || !Array.isArray(allocationIds) || allocationIds.length === 0) {
      return res.status(400).json({ message: 'allocationIds array is required' });
    }

    const { hallsProcessed, missingLayouts } = await regenerateSeating(allocationIds);
    if (hallsProcessed === 0) {
      return res.status(404).json({ message: 'No allocations found for the provided IDs' });
    }

    logger.info('Seating allotment generated', {
      allocationIds, hallsProcessed, missingLayouts, ip: req.ip
    });

    res.json({
      message: 'Seating allotment generated successfully',
      hallsProcessed,
      missingLayouts,
      warnings: missingLayouts.length > 0
        ? missingLayouts.map(h => `No layout found for ${h} — sequential seat numbers used`)
        : [],
      allocationIds,
    });

  } catch (error) {
    logger.error('Seating allotment failed', { message: error.message, stack: error.stack, ip: req.ip });
    res.status(500).json({ message: 'Seating allotment failed. Please try again.' });
  }
});

module.exports = router;
