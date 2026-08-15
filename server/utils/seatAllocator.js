'use strict';

/**
 * allocateSeatsToLayout
 *
 * Assigns students to bench seats SEQUENTIALLY (no shuffle).
 * Students are sorted: year order (I→II→III→IV) → section (A→B→C) → sno.
 * BB benches get two students side by side (seatIndex 0 = left, 1 = right).
 *
 * In labs (hallName contains "lab", case-insensitive) only, if students
 * remain after every bench's normal capacity (SB: 1, BB: 2) is filled,
 * a third student is seated in the middle of an already-full Big Bench
 * (seatIndex 2) rather than left unseated. Classrooms/rooms and small
 * benches — everywhere, including inside labs — are completely
 * unaffected by this; it only ever touches BB benches, and only in labs.
 *
 * @param {Array} benches  - Bench objects from HallLayout: { id, row, col, type, label }
 * @param {Array} students - Student objects: { rollNumber, studentName, section, year, sno }
 * @param {string} [hallName] - Name of the hall being allocated; used only to detect labs.
 * @returns {{ seats, conflictCount, attempts }}
 */
function allocateSeatsToLayout(benches, students, hallName = '') {
  if (!benches || benches.length === 0) {
    return buildSequentialFallback(students);
  }

  const isLab = /lab/i.test(hallName || '');

  // Step 1: fill benches in the exact order they were labeled in Hall
  // Designer (label = the order they were clicked/placed), so the seat
  // that gets filled first always matches bench #1 shown at design time.
  // Falls back to array order for any bench saved before labels existed.
  const sortedBenches = [...benches].sort((a, b) => {
    const la = parseInt(a.label, 10);
    const lb = parseInt(b.label, 10);
    if (!isNaN(la) && !isNaN(lb)) return la - lb;
    return 0;
  });

  // Check if it's an elective exam
  const isElectiveExam = students.some(s => (s.electives && s.electives.length > 0) || s.elective);

  // Step 2: sort students sequentially — year order → section → sno
  const YEAR_ORDER = ['I', 'II', 'III', 'IV'];
  const sortedStudents = [...students].sort((a, b) => {
    const ya = YEAR_ORDER.indexOf(a.year || 'I');
    const yb = YEAR_ORDER.indexOf(b.year || 'I');
    if (ya !== yb) return ya - yb;

    const sa = (a.section || '').toUpperCase();
    const sb = (b.section || '').toUpperCase();
    if (sa < sb) return -1;
    if (sa > sb) return 1;

    const snoA = a.sno || parseInt(a.rollNumber, 10) || 0;
    const snoB = b.sno || parseInt(b.rollNumber, 10) || 0;
    return snoA - snoB;
  });

  // Bench states: { bench, seat1: student, seat2: student, seat3: student }
  // seat3 is only ever used for BB benches in labs (see Pass 4 below).
  const benchStates = sortedBenches.map(bench => ({
    bench,
    seat1: null,
    seat2: null,
    seat3: null,
  }));

  // Helper function to check if electives are different
  function haveDifferentElectives(s1, s2) {
    const e1 = s1.electives && s1.electives.length > 0 ? s1.electives : (s1.elective ? [s1.elective] : []);
    const e2 = s2.electives && s2.electives.length > 0 ? s2.electives : (s2.elective ? [s2.elective] : []);
    if (e1.length === 0 || e2.length === 0) return true; // if one has no elective, they are different
    return !e1.some(el => e2.includes(el));
  }

  // Helper to find candidate
  function findBestCandidate(student1, remainingStudents) {
    // Priority 1: Different Year
    let index = remainingStudents.findIndex(s => s.year !== student1.year);
    if (index !== -1) return index;

    // Priority 2: Same Year, Different Elective (if elective exam)
    if (isElectiveExam) {
      index = remainingStudents.findIndex(s => s.year === student1.year && haveDifferentElectives(student1, s));
      if (index !== -1) return index;
    }

    // Priority 3: Fallback (first available)
    if (remainingStudents.length > 0) return 0;

    return -1;
  }

  // Pass 1: Assign seat1 for all benches
  let studentIdx = 0;
  for (const state of benchStates) {
    if (studentIdx < sortedStudents.length) {
      state.seat1 = sortedStudents[studentIdx++];
    }
  }

  // Remaining students for second seats
  const remaining = sortedStudents.slice(studentIdx);

  // Pass 2: Assign seat2 of Big Benches (BB)
  for (const state of benchStates) {
    if (state.bench.type === 'BB' && state.seat1 && remaining.length > 0) {
      const candIdx = findBestCandidate(state.seat1, remaining);
      if (candIdx !== -1) {
        state.seat2 = remaining[candIdx];
        remaining.splice(candIdx, 1);
      }
    }
  }

  // Pass 3: Assign seat2 of Small Benches (SB) (Dynamic expansion)
  for (const state of benchStates) {
    if (state.bench.type === 'SB' && state.seat1 && remaining.length > 0) {
      const candIdx = findBestCandidate(state.seat1, remaining);
      if (candIdx !== -1) {
        state.seat2 = remaining[candIdx];
        remaining.splice(candIdx, 1);
      }
    }
  }

  // Pass 4 — LAB-ONLY overflow: once every bench's normal capacity is
  // full (SB: 1, BB: 2) and students are still left over, seat one more
  // in the middle of an already-full Big Bench. Gated on isLab (hall
  // name contains "lab"), so this never applies to a classroom/room,
  // even one that happens to have BB benches. Small benches are never
  // touched by this pass, in any hall, lab or otherwise.
  if (isLab) {
    for (const state of benchStates) {
      if (state.bench.type === 'BB' && state.seat1 && state.seat2 && remaining.length > 0) {
        const candIdx = findBestCandidate(state.seat1, remaining);
        if (candIdx !== -1) {
          state.seat3 = remaining[candIdx];
          remaining.splice(candIdx, 1);
        }
      }
    }
  }

  // Build final seats array with physical index
  let idx = 1;
  const seats = [];

  for (const state of benchStates) {
    const bench = state.bench;

    // Primary Slot
    if (state.seat1) {
      seats.push({
        seatNumber: idx,
        benchId: bench.id || `bench_${bench.row}_${bench.col}`,
        benchType: bench.type,
        seatIndex: 0,
        rollNumber: state.seat1.rollNumber || '',
        studentName: state.seat1.studentName || '',
        section: state.seat1.section || '',
        year: state.seat1.year || '',
        elective: state.seat1.elective || '',
        electives: state.seat1.electives || [],
        sno: state.seat1.sno || 0,
        displayLabel: buildDisplayLabel(state.seat1),
      });
    }
    idx++;

    // Secondary Slot (always for BB, or for SB if 2nd student seated)
    if (bench.type === 'BB' || state.seat2) {
      if (state.seat2) {
        seats.push({
          seatNumber: idx,
          benchId: bench.id || `bench_${bench.row}_${bench.col}`,
          benchType: bench.type,
          seatIndex: 1,
          rollNumber: state.seat2.rollNumber || '',
          studentName: state.seat2.studentName || '',
          section: state.seat2.section || '',
          year: state.seat2.year || '',
          elective: state.seat2.elective || '',
          electives: state.seat2.electives || [],
          sno: state.seat2.sno || 0,
          displayLabel: buildDisplayLabel(state.seat2),
        });
      }
      idx++;
    }

    // Middle Slot — lab-only overflow (Pass 4). Only ever populated for
    // BB benches, only in labs; state.seat3 is null everywhere else.
    if (state.seat3) {
      seats.push({
        seatNumber: idx,
        benchId: bench.id || `bench_${bench.row}_${bench.col}`,
        benchType: bench.type,
        seatIndex: 2,
        rollNumber: state.seat3.rollNumber || '',
        studentName: state.seat3.studentName || '',
        section: state.seat3.section || '',
        year: state.seat3.year || '',
        elective: state.seat3.elective || '',
        electives: state.seat3.electives || [],
        sno: state.seat3.sno || 0,
        displayLabel: buildDisplayLabel(state.seat3),
      });
      idx++;
    }
  }

  return { seats, conflictCount: 0, attempts: 1 };
}

function buildDisplayLabel(student) {
  const yearLabel = student.year || '';
  const section   = student.section || '';
  const sno       = student.sno || student.rollNumber || '';
  return `${yearLabel} ${section} ${sno}`.trim();
}

function buildSequentialFallback(students) {
  const YEAR_ORDER = ['I', 'II', 'III', 'IV'];
  const sorted = [...students].sort((a, b) => {
    const ya = YEAR_ORDER.indexOf(a.year || 'I');
    const yb = YEAR_ORDER.indexOf(b.year || 'I');
    if (ya !== yb) return ya - yb;
    const sa = (a.section || '').toUpperCase();
    const sb = (b.section || '').toUpperCase();
    if (sa < sb) return -1;
    if (sa > sb) return 1;
    return ((a.sno || 0) - (b.sno || 0));
  });

  return {
    seats: sorted.map((student, idx) => ({
      seatNumber: idx + 1,
      benchId: null,
      benchType: null,
      seatIndex: 0,
      rollNumber: student.rollNumber || '',
      studentName: student.studentName || '',
      section: student.section || '',
      year: student.year || '',
      elective: student.elective || '',
      electives: student.electives || [],
      sno: student.sno || 0,
      displayLabel: buildDisplayLabel(student),
    })),
    conflictCount: 0,
    attempts: 1,
  };
}

module.exports = { allocateSeatsToLayout };
