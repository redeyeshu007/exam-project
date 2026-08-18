import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { FiArrowLeft, FiPrinter, FiUploadCloud, FiX, FiCheckCircle, FiFile, FiEdit2, FiSave, FiXCircle, FiAlignLeft, FiAlignCenter, FiAlignRight, FiType, FiMove, FiGrid, FiAlertTriangle, FiChevronLeft, FiChevronRight, FiCalendar, FiClock, FiRotateCcw, FiRotateCw } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import api from '../services/api';
import { toast } from 'react-toastify';

const PRINT_FONT = '"Times New Roman", Times, serif';
const PAGE_SIZE  = 25;

/* ─── Date helpers ─────────────────────────────────────────────────── */
const fmtShort = (d) =>
  `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(2)}`;

const fmtHeader = (d) =>
  `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getFullYear()).slice(2)}`;

const parseDate = (s) => {
  if (!s) return null;
  const d = new Date(s);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const toDateString = (d) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const defaultSessionFor = (session) => {
  const s = (session || '').toUpperCase().trim();
  if (s === 'FN') return 'FN';
  if (s === 'AN') return 'AN';
  return 'BOTH';
};

const getInitialDateSessions = (fromDate, toDate, session) => {
  const map = {};
  if (!fromDate || !toDate) return map;
  const def = defaultSessionFor(session);
  const cur = new Date(fromDate);
  const end = new Date(toDate);
  while (cur <= end) {
    if (cur.getDay() !== 0) map[toDateString(cur)] = def;
    cur.setDate(cur.getDate() + 1);
  }
  return map;
};

/**
 * Flat date-session columns built from the per-date session map.
 * Each date emits 1 column (FN or AN) or 2 columns (BOTH).
 */
const buildDateCols = (dateSessionMap) => {
  const keys = Object.keys(dateSessionMap || {}).sort();
  const cols = [];
  keys.forEach(ds => {
    const day = new Date(`${ds}T00:00:00`);
    const sess = dateSessionMap[ds];
    if (sess === 'BOTH') {
      cols.push({ date: day, session: 'FN' });
      cols.push({ date: day, session: 'AN' });
    } else if (sess === 'FN' || sess === 'AN') {
      cols.push({ date: day, session: sess });
    }
  });
  return cols;
};

/* ─── Year label ── e.g. "III– A", "III– A & B" ─────────────────── */
const buildYearLabel = (year, sections) => {
  const secs = [...new Set(sections)].sort();
  if (!secs.length)   return year || '';
  if (secs.length===1) return `${year}– ${secs[0]}`;
  return `${year}– ${secs[0]} & ${secs.slice(1).join(' & ')}`;
};

/* ─── Roll Number column ───────────────────────────────────────────
   The left-most column of the attendance sheet prints the Excel/hall-plan
   ROLL NUMBER as-is — it is never a freshly generated 1..N serial:
     - Roll numbers restart per section (Section A 1-5, Section B 1-5),
       so the same roll number can legitimately appear twice in one hall.
     - Duplicates are therefore allowed and printed as given.
     - A roll number whose student details are missing keeps its own row;
       following students are never pulled up to fill the gap.
──────────────────────────────────────────────────────────────────── */

/* Numeric value of a roll number, or null when it isn't a plain number
   (gap detection only ever applies to numeric roll sequences). */
const rollNum = (r) => {
  const s = String(r ?? '').trim();
  if (!s || !/^\d+$/.test(s)) return null;
  return Number(s);
};

/* Safety valve: never materialise an unbounded run of placeholder rows
   from a wildly non-contiguous roll sequence. */
const MAX_ROLL_GAP_FILL = 50;

/* ─── S.No computation ─────────────────────────────────────────────
   Standard : Built from hallAllocations (hall plan). Each entry carries
              the section's fromRoll..toRoll, so the printed roll numbers
              come straight from the plan (restarting per section).
              If Excel data is provided, register numbers & names are
              filled in — matched by Roll No when the file has a Roll No
              column, otherwise consumed in Excel row order. Rows without
              a match are left blank for students to fill during the exam.
   Elective : Built from hallAllocations + studentData (sorted by
              section then rollNumber), NOT from seatingChart.
              Each year's students are listed in hall-plan order, and
              roll numbers skipped by the Excel sheet keep their row.
──────────────────────────────────────────────────────────────────── */
const buildHallStudentsStandard = (allocation, nameMap, excelRows) => {
  const hallMap = {};

  // Ordered Excel rows, when the optional upload supplied them. Falls back
  // to nameMap's insertion order (register numbers only, no roll numbers)
  // so older call sites and files without a Roll No column keep working.
  const rows = (excelRows && excelRows.length > 0)
    ? excelRows
    : (nameMap && nameMap.size > 0
        ? [...nameMap.keys()].map(reg => ({ rollNo: '', registerNo: reg, name: nameMap.get(reg) || '' }))
        : []);

  const rollAware = rows.some(r => String(r.rollNo || '').trim() !== '');

  // Rows that carry real details, keyed by roll number — lets a blank row
  // for roll 15 still print roll 15's student if the details for that roll
  // number appear elsewhere in the sheet.
  const detailsByRoll = new Map();
  rows.forEach(r => {
    const key = String(r.rollNo || '').trim();
    if (!key || detailsByRoll.has(key)) return;
    if (r.registerNo || r.name) detailsByRoll.set(key, r);
  });

  const consumed = new Set();      // row indices already printed
  let ptr = 0;                     // next unconsumed row in Excel order

  const advancePtr = () => { while (ptr < rows.length && consumed.has(ptr)) ptr++; };

  /* Pick the row belonging to the expected roll number, without ever
     shifting a later student up into an empty position. */
  const takeRow = (expectedRoll) => {
    advancePtr();
    if (!rollAware) {
      // No Roll No column — positional consumption (previous behaviour).
      const row = rows[ptr];
      if (!row) return null;
      consumed.add(ptr); ptr++;
      return row;
    }

    const want = rollNum(expectedRoll);
    // Skip rows already left behind (roll numbers below what we expect).
    while (ptr < rows.length) {
      advancePtr();
      const row = rows[ptr];
      if (!row) break;
      const key = String(row.rollNo || '').trim();
      if (key === String(expectedRoll ?? '').trim()) {
        consumed.add(ptr); ptr++;
        return row;
      }
      const have = rollNum(key);
      if (want === null || have === null) {
        // Non-numeric roll numbers can't be compared — take positionally.
        consumed.add(ptr); ptr++;
        return row;
      }
      if (have > want) break;   // gap: this position has no row of its own
      ptr++;                    // stale row for an earlier position
    }

    // Gap — recover the details from elsewhere in the sheet if present.
    const elsewhere = detailsByRoll.get(String(expectedRoll ?? '').trim());
    if (elsewhere) {
      const idx = rows.indexOf(elsewhere);
      if (idx >= 0 && !consumed.has(idx)) { consumed.add(idx); return elsewhere; }
    }
    return null;
  };

  (allocation.hallAllocations || []).forEach(hall => {
    const students = [];
    let hallSNo = 1;
    (hall.entries || []).forEach(entry => {
      const count = (entry.count !== undefined && entry.count > 0)
        ? entry.count
        : (entry.toRoll - entry.fromRoll + 1);
      // fromRoll is the section's own roll number for the first seat of this
      // entry (it restarts at 1 for every new section), so roll numbers are
      // printed exactly as the plan/Excel has them rather than renumbered.
      const fromRoll = rollNum(entry.fromRoll);
      for (let i = 0; i < count; i++) {
        const roll = fromRoll !== null ? fromRoll + i : hallSNo + i;
        const row = takeRow(roll);
        students.push({
          registerNo: row?.registerNo || '',
          name: row?.name || '',
          section: entry.section,
          sNo: roll,
        });
      }
      hallSNo += count;
    });
    const secs = [...new Set((hall.entries || []).map(e => e.section))];
    hallMap[hall.hallName] = { students, yearLabel: buildYearLabel(allocation.year, secs) };
  });
  return hallMap;
};

const buildHallStudentsElective = (allocation) => {
  const hallMap = {};

  // Index studentData by section, ordered for the Attendance Sheet. As of
  // this allocation-creation logic (see allocations.js), studentData
  // already arrives pre-ordered by Roll No where available, so this is
  // mostly a safety net for older allocations created before that. Register
  // Number is never used to determine order — only ever printed as a
  // value. If the Excel had a separate "Roll No" column (distinct from
  // Register Number), sort numerically by that; otherwise preserve
  // original Excel row order (stable sort — comparator never runs).
  const allStudents = allocation.studentData || [];

  // Roll Number → student, for students whose details ARE filled in. Used to
  // recover a name/register number for a roll number that is missing from
  // its own section run but present elsewhere in the Excel data.
  const detailsByRoll = new Map();
  allStudents.forEach(s => {
    const key = String(s.rollNo || '').trim();
    if (!key || detailsByRoll.has(key)) return;
    if (s.rollNumber || s.studentName) detailsByRoll.set(key, s);
  });

  const sectionStudents = {};
  allStudents.forEach(s => {
    const sec = s.section || '';
    if (!sectionStudents[sec]) sectionStudents[sec] = [];
    sectionStudents[sec].push(s);
  });
  Object.keys(sectionStudents).forEach(sec => {
    const list = sectionStudents[sec];
    const hasRollNo = list.every(s => s.rollNo);
    if (hasRollNo) {
      list.sort((a, b) => {
        const an = Number(a.rollNo), bn = Number(b.rollNo);
        if (!isNaN(an) && !isNaN(bn)) return an - bn;
        return String(a.rollNo).localeCompare(String(b.rollNo));
      });
      // Re-insert the roll numbers the sheet skipped, so e.g. 13,14,16,17
      // still prints a row for 15 and does NOT pull 16/17 up a position.
      // Duplicate roll numbers survive untouched (diff of 0 adds nothing).
      const expanded = [];
      list.forEach((s, i) => {
        if (i > 0) {
          const prev = rollNum(list[i - 1].rollNo);
          const cur  = rollNum(s.rollNo);
          if (prev !== null && cur !== null && cur - prev > 1 && cur - prev - 1 <= MAX_ROLL_GAP_FILL) {
            for (let r = prev + 1; r < cur; r++) {
              const found = detailsByRoll.get(String(r));
              expanded.push({ ...(found || {}), section: sec, rollNo: String(r), __gap: true });
            }
          }
        }
        expanded.push(s);
      });
      sectionStudents[sec] = expanded;
    }
    // else: leave as original Excel row order (Array.sort is never called,
    // so insertion order from allocation.studentData is preserved as-is).
  });

  // Sequential pointer per section — students are consumed in hall-plan
  // order (first hall gets first N students of that section, etc.)
  const sectionPointer = {};

  (allocation.hallAllocations || []).forEach(hall => {
    const students = [];
    let sNo = 1;

    // Entries in hallAllocations already list sections in year-order
    // (the hall plan guarantees this), so each year's block appears
    // together — no extra sorting needed here.
    (hall.entries || []).forEach(entry => {
      const sec = entry.section;
      const count = (entry.count !== undefined && entry.count > 0)
        ? entry.count
        : (entry.toRoll - entry.fromRoll + 1);
      if (sectionPointer[sec] === undefined) sectionPointer[sec] = 0;
      const secList = sectionStudents[sec] || [];
      // `count` is the number of REAL students the hall plan assigned here.
      // Gap placeholders ride along in position without consuming a slot, so
      // hall composition stays exactly as allocated.
      let taken = 0;
      while (taken < count) {
        const student = secList[sectionPointer[sec]++] || null;
        if (!student || !student.__gap) taken++;
        students.push({
          // Print the Excel Roll No as-is; fall back to a running number only
          // for sections that have no Roll No column at all.
          sNo: student?.rollNo ? student.rollNo : sNo,
          registerNo: student?.rollNumber || '',
          name: student?.studentName || '',
          section: sec,
          elective: student?.elective || '',
          electives: student?.electives || [],
          year: allocation.year,
        });
        sNo++;
      }
    });

    const secs = [...new Set((hall.entries || []).map(e => e.section))];
    hallMap[hall.hallName] = { students, yearLabel: buildYearLabel(allocation.year, secs) };
  });

  return hallMap;
};

/* ─── Compute max date columns that fit one A4 page (182mm usable) ──── */
/* Cap at 8: any 9th date onward overflows to a new page automatically.   */
const getMaxDateCols = (n) => {
  if (n <= 5)  return 5;
  return 8;   // hard cap — 9th date and beyond go to the next page
};

/* ─── Per-page column widths (all in px, tableLayout: fixed) ─────── */
const colWidths = (n) => {
  // S.No, Register, Name and date col widths.
  // We keep S.No and Register relatively stable.
  // NOTE: the call site caps n at 8 (colWidths(Math.min(8, totalDateCols))),
  // so 8 is the practical maximum ever passed here. At exactly 8 date
  // columns, the previous boundary (n<=8 using the 55px date width)
  // squeezed the Name column down to ~98px — narrow enough that every
  // student name wrapped to 2 lines, which silently doubled row height and
  // collapsed how many students fit on a page. Moving the boundary to
  // n<=7 means 8 date columns now use the narrower 46px date width
  // instead, leaving Name a comfortable ~182px with no wrapping.
  if (n <= 5)  return { sno: '32px', reg: '135px', date: '65px' };
  if (n <= 7)  return { sno: '30px', reg: '125px', date: '55px' };
  return               { sno: '28px', reg: '115px', date: '46px' };
};

/* ─── Font size for date header cells ────────────────────────────── */
const dateFontSize = (n) => {
  if (n <= 6)  return '8.5pt';
  if (n <= 8)  return '8pt';
  if (n <= 10) return '7.5pt';
  return '7pt';
};

/* ─── Font size for the Register No cell — shrinks for unusually long
   register numbers so they always stay on one line. A wrapped register
   number would grow that row's height past what the page's row-capacity
   budget assumed, overflowing the print page instead of the row. ───── */
const regNoFontSize = (len) => {
  if (len <= 12) return '9pt';
  if (len <= 14) return '8pt';
  if (len <= 16) return '7pt';
  return '6.5pt';
};

/* ─── Page header (repeats on every A4 page) ─────────────────────── */
const SheetHeader = ({ allocation, hallName, yearLabel, examTitle }) => {
  const fromDate = parseDate(allocation.fromDate);
  const toDate   = parseDate(allocation.toDate) || fromDate;
  const INFO = {
    fontFamily: PRINT_FONT, fontSize: '10.5pt', fontWeight: 'bold',
    padding: '2px 0', lineHeight: '1.35', color: '#000',
  };
  return (
    <>
      {/* College heading */}
      <div style={{ textAlign: 'center', marginBottom: '5px', lineHeight: '1.45', position: 'relative' }}>
        <img
          src="/psna2logo.png"
          alt="PSNA"
          style={{
            position: 'absolute', left: '0', top: '0',
            width: '48px', height: '48px', objectFit: 'contain',
          }}
        />
        <div style={{ fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '13pt', color: '#000', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          PSNA COLLEGE OF ENGINEERING AND TECHNOLOGY, DINDIGUL
        </div>
        <div style={{ fontFamily: PRINT_FONT, fontSize: '10pt', fontStyle: 'italic', fontWeight: 'bold', color: '#000', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          (An Autonomous Institution Affiliated to Anna University, Chennai)
        </div>
        <div style={{ fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '11pt', textDecoration: 'underline', marginTop: '2px', color: '#000', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          ATTENDANCE SHEET
        </div>
        <div style={{ fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '10.5pt', textDecoration: 'underline', color: '#000', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          {examTitle}
        </div>
      </div>

      {/* Info strip */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4px' }}>
        <tbody>
          <tr>
            <td style={{ ...INFO, width: '28%' }}>Year: {yearLabel}</td>
            <td style={{ ...INFO, width: '19%' }}>Semester: {allocation.semester}</td>
            <td style={{ ...INFO, width: '16%' }}>Degree: B.E</td>
            <td style={{ ...INFO }}>Branch: CSE</td>
          </tr>
          <tr>
            <td colSpan={2} style={INFO}>Hall No: {hallName}</td>
            <td colSpan={2} style={{ ...INFO, textAlign: 'right' }}>
              Date of Exam:&nbsp;
              {fromDate ? fmtHeader(fromDate) : ''}&nbsp;to&nbsp;{toDate ? fmtHeader(toDate) : ''}
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
};

/* ─── Single A4 sheet page ──────────────────────────────────────────
   Handles dynamic column width + automatic column-group pagination.
   buildSheets() already splits rows per page (FIRST_LAST/FIRST_ONLY/MID/
   LAST_ONLY); here we additionally split date columns so the table never
   overflows A4 width.
──────────────────────────────────────────────────────────────────── */
const AttendanceSheetPage = ({
  allocation, hallName, yearLabel, students, dateCols, isLastPage, isFirstPage, timetableData,
  dateGroupIdx, totalDateGroups, totalDateCols
}) => {
  /* ── Per-subject student count for THIS hall (elective only) ──
     Primary source: allocation.hallSubjectCounts[hallName] — computed
     server-side from the elective Excel upload and persisted in MongoDB.
     Fallback: re-derive on the fly from seat-level elective data so the
     row still renders for older allocations missing hallSubjectCounts.

     Matching is robust:
       - Normalises to alphanumerics only & uppercase, so "UI/UX",
         "UI-UX", and "UIUX" all collapse to "UIUX".
       - A timetable cell may bundle several electives ("UI-UX / TSA",
         "FDM / RSC / WC"); we split on / , & and render a count for
         each elective fragment.  */
  const norm = (s) => String(s || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  const splitSubjects = (s) =>
    String(s || '').split(/[\/,&]+/).map(p => p.trim()).filter(Boolean);

  const electiveList   = allocation.electiveSubjects || [];
  const electiveByKey  = {};
  electiveList.forEach(s => { electiveByKey[norm(s)] = s; });
  const hasElectives   = !!allocation.hasElectives && electiveList.length > 0;

  const persistedCounts = (allocation.hallSubjectCounts || {})[hallName] || null;
  const persistedByKey  = {};
  if (persistedCounts) {
    Object.keys(persistedCounts).forEach(k => {
      persistedByKey[norm(k)] = persistedCounts[k];
    });
  }

  // Returns count for a single elective subject (or null if not elective).
  // Uses persisted hallSubjectCounts when available; otherwise counts from
  // studentData filtered to those assigned to this hall (via hallAllocations).
  const hallAlloc = (allocation.hallAllocations || []).find(h => h.hallName === hallName);
  const hallSections = new Set((hallAlloc?.entries || []).map(e => e.section));

  const countForElectiveLabel = (label) => {
    const key = norm(label);
    if (!key || !electiveByKey[key]) return null;
    if (persistedByKey[key] !== undefined) return persistedByKey[key];
    let count = 0;
    (allocation.studentData || []).forEach(s => {
      if (!hallSections.has(s.section)) return;
      const picks = new Set();
      if (s.elective) picks.add(norm(s.elective));
      (s.electives || []).forEach(e => picks.add(norm(e)));
      if (picks.has(key)) count++;
    });
    return count;
  };

  // For a timetable cell that may bundle multiple electives, return
  // [{label, count}] for the fragments that ARE elective subjects.
  const subjectCountsForHall = (subjectCell) => {
    const parts = splitSubjects(subjectCell);
    const out = [];
    parts.forEach(p => {
      const c = countForElectiveLabel(p);
      if (c !== null) {
        // Display the canonical elective name as configured in the
        // allocation (preserves original casing like "UI/UX"), falling
        // back to the timetable label if not found.
        const canonical = electiveByKey[norm(p)] || p;
        out.push({ label: canonical, count: c });
      }
    });
    return out;
  };

  const anyElectiveInTimetable = (timetableData || []).some(e =>
    subjectCountsForHall(e.subject).length > 0
  );
  const examTitle = `${allocation.examName || ''} (${allocation.academicYear || ''} ${allocation.semesterType || ''})`;

  const n    = dateCols.length;
  // Use the max potential width for this hall to keep column alignment across pages (cap 8)
  const cw   = colWidths(Math.min(8, totalDateCols));
  const dfs  = dateFontSize(n);

  /* ── Shared cell styles — matching HallPlanPrint exactly ── */
  const TH = {
    fontFamily: PRINT_FONT, fontSize: '10.5pt', fontWeight: 'bold',
    padding: '5px 4px', textAlign: 'center', verticalAlign: 'middle',
    border: '1.5px solid #000', color: '#000',
    backgroundColor: '#f0f0f0',
    WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
    lineHeight: '1.3',
  };
  const TD = {
    fontFamily: PRINT_FONT, fontSize: '10.5pt', fontWeight: 'bold',
    padding: '5px 4px', border: '1px solid #000', color: '#000',
    lineHeight: '1.35', height: '24px',
    wordBreak: 'break-word', whiteSpace: 'normal',
    verticalAlign: 'middle',
  };
  const DateTH = {
    ...TH,
    fontSize: dfs,
    padding: '3px 2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  };

  return (
    <div
      className="attendance-sheet-inner"
      style={{
        padding: '12mm 14mm 10mm',
        fontFamily: PRINT_FONT,
        boxSizing: 'border-box',
        // Allow the sheet to grow if a tall timetable is appended so content
        // is never silently clipped on screen. Print CSS still clamps to A4
        // and uses page-break rules to push overflowing timetables to a new
        // page. The page-break-inside: avoid on .timetable-inline-section
        // ensures the timetable is moved as a block, never split.
        minHeight: '297mm',
        position: 'relative'
      }}
    >
      {/* Header only on first row-chunk of a hall */}
      {isFirstPage && (
        <SheetHeader
          allocation={allocation}
          hallName={hallName}
          yearLabel={yearLabel}
          examTitle={examTitle}
        />
      )}

      {/* Column-group label when split across pages */}
      {totalDateGroups > 1 && (
        <div style={{ fontFamily: PRINT_FONT, fontSize: '8.5pt', fontWeight: 'bold', textAlign: 'right', marginBottom: '3px', color: '#333', fontStyle: 'italic' }}>
          Date Group {dateGroupIdx + 1} of {totalDateGroups}
        </div>
      )}

      {/* ── Attendance table ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', border: '1.5px solid #000' }}>
        <colgroup>
          <col style={{ width: cw.sno }} />
          <col style={{ width: cw.reg }} />
          <col />
          {dateCols.map((_, i) => <col key={i} style={{ width: cw.date }} />)}
        </colgroup>

        <thead>
          <tr>
            <th style={{ ...TH, verticalAlign: 'bottom', padding: '3px 2px' }}>S</th>
            <th rowSpan={2} style={{ ...TH, verticalAlign: 'middle' }}>Register No</th>
            <th rowSpan={2} style={{ ...TH, verticalAlign: 'middle', textAlign: 'left', paddingLeft: '6px' }}>
              Name of the Student
            </th>
            {dateCols.map((col, i) => (
              <th key={i} style={DateTH}>{fmtShort(col.date)}</th>
            ))}
          </tr>
          <tr>
            <th style={{ ...TH, verticalAlign: 'top', padding: '3px 2px' }}>No</th>
            {dateCols.map((col, i) => (
              <th key={i} style={DateTH}>{col.session}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {students.map((stu, idx) => (
            <tr key={idx} style={{ pageBreakInside: 'avoid' }}>
              <td style={{ ...TD, textAlign: 'center', fontSize: '10pt' }}>
                {stu.sNo}.
              </td>
              <td style={{
                ...TD, textAlign: 'center',
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: regNoFontSize((stu.registerNo || '').length),
                letterSpacing: '0.2px',
                whiteSpace: 'nowrap',
              }}>
                {stu.registerNo}
              </td>
              <td style={{ ...TD, paddingLeft: '6px', textAlign: 'left', textTransform: 'uppercase' }}>
                {stu.name}
              </td>
              {dateCols.map((_, ci) => <td key={ci} style={TD} />)}
            </tr>
          ))}

          {/* Footer rows — only on the VERY last page of the hall */}
          {isLastPage && (() => {
            const crossCell = { ...TD, padding: 0, fontWeight: 'normal' };
            const footerRows = [
              { label: 'Number of Students Present :', bold: true,  height: '26px' },
              { label: 'Number of Students Absent :',  bold: true,  height: '26px' },
              { label: 'Invigilator Signature',        bold: true,  height: '36px' },
              { label: 'Designation & Department',     bold: true,  height: '30px' },
            ];
            return footerRows.map(({ label, bold, height }) => (
              <tr key={label} style={{ pageBreakInside: 'avoid' }}>
                <td colSpan={3} style={{
                  ...TD, height,
                  fontWeight: bold ? 'bold' : 'normal',
                  fontSize: '10.5pt',
                  paddingLeft: '8px',
                  border: '1.5px solid #000',
                }}>
                  {label}
                </td>
                {dateCols.map((_, ci) => (
                  <td key={ci} style={{ ...crossCell, border: '1px solid #000', height }} />
                ))}
              </tr>
            ));
          })()}
        </tbody>
      </table>

      {/* Note — only on final page */}
      {isLastPage && (
        <div style={{ fontFamily: PRINT_FONT, fontSize: '10pt', marginTop: '5px', fontWeight: 'bold', color: '#000', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          Note: Mark &ldquo;AB&rdquo; for Absent
        </div>
      )}



      {/* ── Subject-wise Timetable — bottom of last page of each hall ── */}
      {isLastPage && timetableData && timetableData.length > 0 && (() => {
        // High-contrast styles tuned for print: pure black ink, thicker
        // borders, bold/extra-bold weight, and white backgrounds with
        // `printColorAdjust: exact` so the label cells render crisply.
        const ttCell = {
          border: '1.5px solid #000',
          padding: '3px 5px',
          textAlign: 'center',
          fontFamily: PRINT_FONT,
          fontSize: '9pt',
          lineHeight: 1.2,
          fontWeight: 800,
          color: '#000',
          backgroundColor: '#fff',
          verticalAlign: 'middle',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          whiteSpace: 'normal',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        };
        const ttLabel = {
          ...ttCell,
          fontWeight: 900,
          textAlign: 'left',
          minWidth: '70px',
          whiteSpace: 'nowrap',
          backgroundColor: '#d9dcdf',
          textTransform: 'uppercase',
          letterSpacing: '0.2px',
        };
        const ttHeader = {
          ...ttCell,
          fontWeight: 900,
          backgroundColor: '#d9dcdf',
        };

        // Total students in THIS hall — used for common (non-elective)
        // subjects where everyone in the hall writes the exam.
        // NOTE: `students` here is only the row slice for this page chunk
        // (buildSheets paginates rows), so we must look up the full hall
        // strength from the authoritative allocation data.
        const hallStrength =
          (allocation.hallAllocations || []).find(h => h.hallName === hallName)?.totalInHall
          ?? students.length;

        // Build textual summary, mixing electives and common subjects:
        //   electives → "UI/UX - 12, TSA - 8"
        //   common    → "IOT - 34" (total hall strength)
        const summaryParts = [];
        const seenSummary = new Set();
        (timetableData || []).forEach(entry => {
          const electiveItems = subjectCountsForHall(entry.subject);
          if (electiveItems.length > 0) {
            electiveItems.forEach(({ label, count }) => {
              const k = norm(label);
              if (seenSummary.has(k)) return;
              seenSummary.add(k);
              summaryParts.push(`${label} - ${count}`);
            });
          } else {
            // Common subject — single label, full hall strength
            const label = String(entry.subject || '').trim();
            const k = norm(label);
            if (!label || seenSummary.has(k)) return;
            seenSummary.add(k);
            summaryParts.push(`${label} - ${hallStrength}`);
          }
        });

        return (
          <div className="timetable-inline-section" style={{
            marginTop: '8px',
            // Guaranteed bottom gap so the timetable never touches the page
            // edge — strict requirement: minimum 5–8px breathing room.
            marginBottom: '6px',
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
            color: '#000',
          }}>
            <div style={{
              fontFamily: PRINT_FONT, fontSize: '10pt',
              fontWeight: 900, textDecoration: 'underline',
              marginBottom: '3px', color: '#000',
              WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
            }}>
              Subject-wise Timetable
            </div>
            {summaryParts.length > 0 && (
              <div style={{
                fontFamily: PRINT_FONT, fontSize: '9.5pt', fontWeight: 800,
                marginBottom: '4px', color: '#000', lineHeight: 1.25,
                WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
              }}>
                Number of Students per Subject:&nbsp;{summaryParts.join(', ')}
              </div>
            )}
            <table className="subject-timetable" style={{
              width: '100%', borderCollapse: 'collapse',
              fontFamily: PRINT_FONT, tableLayout: 'fixed',
              border: '2px solid #000',
              backgroundColor: '#fff',
              color: '#000',
              WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact',
            }}>
              {/* Explicit colgroup so the label column (DATE/TIMING/SUBJECT/
                  STUDENTS) always keeps enough width to stay on one line —
                  under tableLayout:auto the print engine could squeeze it
                  below its minWidth hint and wrap "STUDENTS" mid-word. */}
              <colgroup>
                <col style={{ width: '95px' }} />
                {timetableData.map((_, ci) => <col key={ci} />)}
              </colgroup>
              <tbody>
                {/* Row 1: Dates */}
                <tr>
                  <td className="tt-head" style={ttLabel}>Date</td>
                  {timetableData.map((entry, ci) => {
                    const d = new Date(entry.date + 'T00:00:00');
                    const display = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                    return <td key={ci} className="tt-head" style={ttHeader}>{display}</td>;
                  })}
                </tr>
                {/* Row 2: Timing */}
                <tr>
                  <td className="tt-head" style={ttLabel}>Timing</td>
                  {timetableData.map((entry, ci) => (
                    <td key={ci} style={ttCell}>{entry.time || '\u2014'}</td>
                  ))}
                </tr>
                {/* Row 3: Subject */}
                <tr>
                  <td className="tt-head" style={ttLabel}>Subject</td>
                  {timetableData.map((entry, ci) => (
                    <td key={ci} style={{ ...ttCell, fontWeight: 900 }}>
                      {entry.subject}
                    </td>
                  ))}
                </tr>
                {/* Row 4: Per-hall student count.
                    - Elective cell ("UI-UX / TSA"): one "LABEL - count"
                      line per elective fragment.
                    - Common subject cell (IOT, CCS, LA, …): one
                      "<SUBJECT> - <hallStrength>" line per fragment. */}
                <tr>
                  <td className="tt-head" style={ttLabel}>Students</td>
                  {timetableData.map((entry, ci) => {
                    const items = subjectCountsForHall(entry.subject);
                    if (items.length === 0) {
                      // Non-elective / common subject(s). Render each
                      // fragment with the full hall strength (e.g. IOT - 20).
                      const parts = splitSubjects(entry.subject);
                      const labels = (parts.length > 0 ? parts : [String(entry.subject || '').trim()])
                        .filter(Boolean);
                      return (
                        <td key={ci} style={{ ...ttCell, whiteSpace: 'normal', fontWeight: 900 }}>
                          {labels.map((lbl, i) => (
                            <div key={i} style={{ lineHeight: 1.15 }}>
                              {lbl} - {hallStrength}
                            </div>
                          ))}
                        </td>
                      );
                    }
                    return (
                      <td key={ci} style={{ ...ttCell, whiteSpace: 'normal', fontWeight: 900 }}>
                        {items.map((it, i) => (
                          <div key={i} style={{ lineHeight: 1.15 }}>
                            {it.label} - {it.count}
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
};

/* ─── Mini Excel Grid ───────────────────────────────────────────────
   Shown on-screen when Row & Col mode is ON.
   Provides Excel-like editing: editable cells, add/delete rows & cols.
   This component is screen-only (no-print class on wrapper).
──────────────────────────────────────────────────────────────────── */
const MiniExcelGrid = ({ sheet, onAddRow, onDeleteRow, onAddCol, onDeleteCol, onCellChange }) => {
  const { students, dateCols, hallName, yearLabel } = sheet;

  const EG = '#217346';       // Excel green
  const EG_D = '#1a5c38';    // darker
  const EG_L = '#e8f5e9';    // hover row
  const BORDER = '#c6cdd3';

  const hdr = {
    background: EG, color: 'white', fontWeight: '600',
    border: `1px solid ${EG_D}`, padding: '6px 8px',
    textAlign: 'center', userSelect: 'none', whiteSpace: 'nowrap',
    fontSize: '11px',
  };

  const rowHdr = {
    background: '#eef2ee', color: '#444', fontSize: '11px', fontWeight: '600',
    border: `1px solid ${BORDER}`, padding: '2px 6px',
    textAlign: 'center', userSelect: 'none', whiteSpace: 'nowrap', width: '58px',
  };

  const cell = {
    border: `1px solid ${BORDER}`, padding: 0, height: '26px',
    background: 'white',
  };

  const inp = {
    width: '100%', height: '100%', border: 'none', outline: 'none',
    background: 'transparent', fontFamily: '"Calibri","Arial",sans-serif',
    fontSize: '12px', padding: '2px 6px', color: '#1B0A12', boxSizing: 'border-box',
  };

  return (
    <div style={{
      background: 'white', borderRadius: '10px',
      border: `2px solid ${EG}`,
      boxShadow: '0 4px 24px rgba(33,115,70,0.18)',
      overflow: 'hidden', marginBottom: '20px',
    }}>
      {/* Title bar */}
      <div style={{
        background: EG, color: 'white', padding: '8px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontWeight: '700', fontSize: '13px', fontFamily: "'DM Sans',sans-serif" }}>
          Hall: {hallName} — {yearLabel}
        </span>
        <span style={{ fontSize: '11px', opacity: 0.85 }}>
          {students.length} row{students.length !== 1 ? 's' : ''} &nbsp;·&nbsp; {dateCols.length} date col{dateCols.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontFamily: '"Calibri","Arial",sans-serif', fontSize: '12px', minWidth: '100%' }}>
          <thead>
            <tr>
              {/* Row # col header */}
              <th style={{ ...hdr, background: EG_D, width: '58px' }}>#</th>
              <th style={{ ...hdr, width: '48px' }}>S.No</th>
              <th style={{ ...hdr, width: '162px', textAlign: 'left' }}>Register No</th>
              <th style={{ ...hdr, minWidth: '220px', textAlign: 'left' }}>Name of the Student</th>
              {dateCols.map((col, i) => (
                <th key={i} style={{ ...hdr, width: '72px', position: 'relative' }}>
                  <div style={{ fontSize: '10px' }}>{fmtShort(col.date)}</div>
                  <div style={{ fontSize: '9px', opacity: 0.85 }}>{col.session}</div>
                  {/* Delete col × */}
                  <span
                    onClick={() => onDeleteCol(i)}
                    title="Delete this date column"
                    style={{
                      position: 'absolute', top: 3, right: 3,
                      width: 15, height: 15, borderRadius: '50%',
                      background: '#EF4444', color: 'white', fontSize: '9px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontWeight: 'bold',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
                    }}
                  >×</span>
                </th>
              ))}
              {/* Add col + */}
              <th
                onClick={onAddCol}
                title="Add date column"
                style={{ ...hdr, background: EG_D, width: '36px', fontSize: '20px', fontWeight: '700', cursor: 'pointer' }}
              >+</th>
            </tr>
          </thead>
          <tbody>
            {students.map((stu, ri) => (
              <tr key={ri}
                style={{ background: ri % 2 === 0 ? 'white' : '#f7fdf8' }}
                onMouseEnter={e => e.currentTarget.style.background = EG_L}
                onMouseLeave={e => e.currentTarget.style.background = ri % 2 === 0 ? 'white' : '#f7fdf8'}
              >
                {/* Row number + delete × */}
                <td style={rowHdr}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                    <span>{ri + 1}</span>
                    <span
                      onClick={() => onDeleteRow(ri)}
                      title="Delete row"
                      style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#EF4444', color: 'white', fontSize: '10px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontWeight: 'bold', flexShrink: 0,
                      }}
                    >×</span>
                  </div>
                </td>
                {/* S.No */}
                <td style={cell}>
                  <input
                    type="text" value={stu.sNo ?? ''}
                    onChange={e => onCellChange(ri, 'sNo', e.target.value)}
                    style={{ ...inp, textAlign: 'center' }}
                    onFocus={e => { e.target.parentElement.style.outline = `2px solid ${EG}`; e.target.parentElement.style.outlineOffset = '-2px'; }}
                    onBlur={e => { e.target.parentElement.style.outline = 'none'; }}
                  />
                </td>
                {/* Register No */}
                <td style={cell}>
                  <input
                    type="text" value={stu.registerNo ?? ''}
                    onChange={e => onCellChange(ri, 'registerNo', e.target.value)}
                    style={{ ...inp, fontFamily: '"Courier New",monospace', fontSize: '11px' }}
                    onFocus={e => { e.target.parentElement.style.outline = `2px solid ${EG}`; e.target.parentElement.style.outlineOffset = '-2px'; }}
                    onBlur={e => { e.target.parentElement.style.outline = 'none'; }}
                  />
                </td>
                {/* Name */}
                <td style={cell}>
                  <input
                    type="text" value={stu.name ?? ''}
                    onChange={e => onCellChange(ri, 'name', e.target.value)}
                    style={inp}
                    onFocus={e => { e.target.parentElement.style.outline = `2px solid ${EG}`; e.target.parentElement.style.outlineOffset = '-2px'; }}
                    onBlur={e => { e.target.parentElement.style.outline = 'none'; }}
                  />
                </td>
                {/* Date placeholder cells */}
                {dateCols.map((_, ci) => (
                  <td key={ci} style={{ ...cell, background: '#f7fdf8' }} />
                ))}
                {/* Filler under + col */}
                <td style={{ ...cell, background: '#eef2ee' }} />
              </tr>
            ))}

            {/* Add row */}
            <tr>
              <td
                colSpan={4 + dateCols.length + 1}
                onClick={onAddRow}
                title="Add a new row"
                style={{
                  textAlign: 'center', padding: '8px',
                  background: '#f0fdf4', border: `2px dashed ${EG}`,
                  cursor: 'pointer', color: EG, fontWeight: '700', fontSize: '14px',
                  userSelect: 'none', letterSpacing: '0.5px',
                }}
              >+ Add Row</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ─── Excel upload panel ────────────────────────────────────────────── */
const ExcelUpload = ({ onDataReady, expectedCount }) => {
  const [dragOver,    setDragOver]    = useState(false);
  const [processing,  setProcessing]  = useState(false);
  const [selectedFile,setSelectedFile]= useState(null);
  const [parseResult, setParseResult] = useState(null);
  const fileInputRef = useRef();

  const parseExcel = useCallback(async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type:'array' });
          resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:'' }));
        } catch(err) { reject(err); }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const processFile = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx','xls','csv'].includes(ext)) {
      toast.error('Upload .xlsx, .xls or .csv'); return;
    }
    setProcessing(true); setSelectedFile(file);
    try {
      const rows = await parseExcel(file);
      if (!rows.length) { toast.error('File is empty'); setProcessing(false); return; }

      const headers = Object.keys(rows[0]);
      let regCol = null, nameCol = null, rollCol = null;
      headers.forEach(h => {
        const low = h.toLowerCase().replace(/\s+/g,' ').trim();
        if (!regCol && (
          low.includes('register no') || low.includes('reg no') ||
          low === 'register' || low === 'regno' || low === 'registration no' ||
          low === 'registration number' || low === 'register number'
        )) regCol = h;
        if (!nameCol && (
          low.includes('name of the student') || low.includes('student name') ||
          low === 'name' || low === 'student_name'
        )) nameCol = h;
        // Optional — when present, roll numbers are matched positionally so a
        // roll number with no student details keeps its own row in the sheet.
        if (!rollCol && (
          low === 'roll no' || low === 'rollno' || low === 'roll no.' ||
          low === 'roll number' || low === 's.no' || low === 'sno' ||
          low === 's no' || low === 'sl no'
        )) rollCol = h;
      });

      if (!regCol)  {
        toast.error('No "Register No" column found. Column must be named "Register No", "Reg No", or "Registration No".');
        setProcessing(false); return;
      }
      if (!nameCol) {
        toast.error('No "Name" column found. Column must be named "Name", "Student Name", or "Name of the Student".');
        setProcessing(false); return;
      }

      const map = new Map();
      // Ordered rows — kept in exact Excel order, INCLUDING rows whose
      // student details are blank, so a Roll No that exists in the sequence
      // without details never gets removed or shifted out of position.
      const orderedRows = [];
      rows.forEach(row => {
        const reg  = String(row[regCol]  || '').trim();
        const name = String(row[nameCol] || '').trim().toUpperCase();
        const roll = rollCol ? String(row[rollCol] || '').trim() : '';
        if (reg && name) map.set(reg, name);
        if (reg || name || roll) orderedRows.push({ rollNo: roll, registerNo: reg, name });
      });

      if (!map.size) { toast.error('No valid rows found'); setProcessing(false); return; }
      setParseResult({ map, rows: orderedRows, count: map.size, regCol, nameCol, rollCol });
      toast.success(`Loaded ${map.size} student records`);
    } catch { toast.error('Failed to parse file'); }
    finally   { setProcessing(false); }
  }, [parseExcel]);

  const clearFile = () => {
    setSelectedFile(null); setParseResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div style={{
      background:'white', borderRadius:'20px', border:'1.5px solid #E8E2E5',
      boxShadow:'0 4px 20px rgba(27,10,18,0.07)', padding:'32px',
      maxWidth:'600px', margin:'0 auto',
    }}>
      <h3 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontWeight:'800', fontSize:'20px', color:'#1B0A12', marginBottom:'8px' }}>
        Upload Student Data
      </h3>
      <p style={{ color:'#9B8F94', fontSize:'14px', marginBottom:'24px', lineHeight:'1.5' }}>
        Standard allocation — names are not stored. Upload an Excel file with{' '}
        <strong style={{ color:'#1B0A12' }}>Register No</strong> and{' '}
        <strong style={{ color:'#1B0A12' }}>Name of the Student</strong> columns.
      </p>

      {!parseResult && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); if(e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); }}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border:`2px dashed ${dragOver ? '#B42B6A' : '#E8E2E5'}`,
            borderRadius:'14px', padding:'40px 24px', textAlign:'center',
            cursor:'pointer', background: dragOver ? '#FDF2F7' : '#FAF7F9',
            transition:'all 0.2s', marginBottom:'16px',
          }}
        >
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }}
            onChange={e => { if(e.target.files[0]) processFile(e.target.files[0]); }} />
          {processing
            ? <div className="spinner-border" style={{ color:'#B42B6A' }} role="status"><span className="visually-hidden">Processing…</span></div>
            : <>
                <FiUploadCloud size={40} color={dragOver ? '#B42B6A' : '#9B8F94'} style={{ marginBottom:'12px' }} />
                <p style={{ color: dragOver ? '#B42B6A' : '#6B5E63', fontWeight:'600', fontSize:'15px', margin:'0 0 4px' }}>
                  Drop your Excel file here or click to browse
                </p>
                <p style={{ color:'#9B8F94', fontSize:'13px', margin:0 }}>Supports .xlsx, .xls, .csv</p>
              </>
          }
        </div>
      )}

      {parseResult && (() => {
        const mismatch = expectedCount && parseResult.count !== expectedCount;
        return (
          <div style={{
            background: mismatch ? '#FFF7ED' : '#F0FDF4',
            border: `1.5px solid ${mismatch ? '#FCA5A5' : '#86EFAC'}`,
            borderRadius:'14px', padding:'20px', marginBottom:'20px',
            display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              <FiCheckCircle size={24} color={mismatch ? '#EF4444' : '#16A34A'} />
              <div>
                <div style={{ fontWeight:'700', color:'#1B0A12', fontSize:'14px' }}>{selectedFile?.name}</div>
                <div style={{ color: mismatch ? '#EF4444' : '#16A34A', fontSize:'13px', fontWeight:'600' }}>
                  {parseResult.count} students loaded
                  {mismatch && ` (allocation expects ${expectedCount})`}
                </div>
                <div style={{ color:'#6B5E63', fontSize:'12px' }}>
                  <em>{parseResult.regCol}</em> → <em>{parseResult.nameCol}</em>
                </div>
              </div>
            </div>
            <button onClick={clearFile} style={{ background:'none', border:'none', cursor:'pointer', color:'#9B8F94', padding:'4px' }}>
              <FiX size={18} />
            </button>
          </div>
        );
      })()}

      <div style={{ background:'#FDF2F7', borderRadius:'10px', padding:'12px 16px', border:'1px solid rgba(180,43,106,0.15)', marginBottom:'24px' }}>
        <p style={{ margin:0, fontSize:'12px', color:'#6B5E63', lineHeight:'1.8' }}>
          <strong style={{ color:'#B42B6A' }}>Required columns (exact names):</strong><br/>
          &bull; <code>Register No</code> — university register number (e.g. 230392131042001)<br/>
          &bull; <code>Name</code> or <code>Name of the Student</code> — full student name<br/>
          <span style={{ color:'#9B8F94', fontSize:'11px' }}>
            Optional: a <code>Roll No</code> / <code>S.No</code> column. When present, rows are
            matched by Roll No — a Roll No with no student details keeps its own blank row and
            the students after it are never moved up.
          </span>
        </p>
      </div>

      <button
        disabled={!parseResult}
        onClick={() => parseResult && onDataReady(parseResult.map, parseResult.rows)}
        style={{
          width:'100%', padding:'13px', borderRadius:'50px', border:'none',
          background: parseResult ? 'linear-gradient(135deg,#B42B6A 0%,#9A2259 100%)' : '#E8E2E5',
          color: parseResult ? 'white' : '#9B8F94',
          fontWeight:'700', fontSize:'15px', cursor: parseResult ? 'pointer' : 'not-allowed',
          boxShadow: parseResult ? '0 4px 14px rgba(180,43,106,0.30)' : 'none',
          transition:'all 0.2s',
        }}
      >
        Generate Attendance Sheets
      </button>
    </div>
  );
};

// Saturday helpers removed; date grid handles selection

/* ─── Main component ─────────────────────────────────────────────────── */
const AttendancePrint = () => {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const [allocation, setAllocation] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [nameMap,    setNameMap]    = useState(null);
  // Ordered Excel rows (incl. Roll No, when the file had that column) — drives
  // roll-number-based positioning of the standard attendance sheet.
  const [excelRows,  setExcelRows]  = useState(null);
  const [showDatePrompt, setShowDatePrompt] = useState(false);
  const [dateSessionMap, setDateSessionMap] = useState({});
  const [sessionPopupDate, setSessionPopupDate] = useState(null);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [isEditing,    setIsEditing]    = useState(false);
  const [dragMode,     setDragMode]     = useState(false);
  const [rowColMode,   setRowColMode]   = useState(false);
  const [editableShts, setEditableShts] = useState(null);
  const [textBoxes,    setTextBoxes]    = useState([]);
  const [showBackModal, setShowBackModal] = useState(false);
  const [draft,         setDraft]         = useState(null);
  const [timetableData, setTimetableData] = useState([]);
  const [ttUploading,   setTtUploading]   = useState(false);
  const [ttFile,        setTtFile]        = useState(null);
  const printRef     = useRef();
  const dragRef      = useRef(null);
  const containerRef  = useRef();
  const userZoomedRef     = useRef(false);
  const [pageScale,   setPageScale]  = useState(1);
  const pageScaleRef      = useRef(1);
  const tbsRef            = useRef([]);
  const editableShtsRef   = useRef(null);

  const ttFileRef = useRef();

  const handleTimetableUpload = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      toast.error('Unsupported format — upload .xlsx, .xls or .csv');
      return;
    }
    setTtUploading(true);
    setTtFile(file);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/timetable/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success && res.data.data.length > 0) {
        setTimetableData(res.data.data);
        toast.success(`Loaded ${res.data.data.length} timetable entries`);
      } else {
        toast.error(res.data.message || 'No valid timetable extracted');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to process timetable file';
      toast.error(msg);
    } finally {
      setTtUploading(false);
    }
  }, []);

  const clearTimetable = () => {
    setTimetableData([]);
    setTtFile(null);
    if (ttFileRef.current) ttFileRef.current.value = '';
  };

  const fmt = useCallback((cmd, val) => {
    document.execCommand(cmd, false, val ?? null);
  }, []);

  /* ── Undo / Redo ── */
  const undoStack = useRef([]);
  const redoStack = useRef([]);

  const handleUndo = useCallback(() => {
    if (undoStack.current.length > 0) {
      const prev = undoStack.current.pop();
      setTextBoxes(cur => { redoStack.current.push({ textBoxes: cur, editableShts: editableShts }); return prev.textBoxes; });
      if (prev.editableShts !== undefined) setEditableShts(prev.editableShts);
    } else {
      document.execCommand('undo');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editableShts]);

  const handleRedo = useCallback(() => {
    if (redoStack.current.length > 0) {
      const next = redoStack.current.pop();
      setTextBoxes(cur => { undoStack.current.push({ textBoxes: cur, editableShts: editableShts }); return next.textBoxes; });
      if (next.editableShts !== undefined) setEditableShts(next.editableShts);
    } else {
      document.execCommand('redo');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editableShts]);

  /* Keep refs in sync */
  useEffect(() => { pageScaleRef.current = pageScale; }, [pageScale]);
  useEffect(() => { tbsRef.current = textBoxes; }, [textBoxes]);
  useEffect(() => { editableShtsRef.current = editableShts; }, [editableShts]);

  /* Keyboard shortcuts */
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault(); handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault(); handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isEditing, handleUndo, handleRedo]);

  const addTextBox = useCallback(() => {
    setTextBoxes(prev => {
      undoStack.current.push({ textBoxes: prev, editableShts: editableShts });
      if (undoStack.current.length > 50) undoStack.current.shift();
      redoStack.current = [];
      return [...prev, { id: Date.now(), x: 60, y: 100, html: 'Text box — click to edit' }];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editableShts]);

  const startDrag = useCallback((e, tb) => {
    dragRef.current = { id: tb.id, startX: e.clientX, startY: e.clientY, origX: tb.x, origY: tb.y, preDragTBs: tbsRef.current };
    e.preventDefault();
  }, []);

  /* Drag: text-box global move / up */
  useEffect(() => {
    if (!isEditing) return;
    const onMove = (e) => {
      if (!dragRef.current) return;
      const { id, startX, startY, origX, origY } = dragRef.current;
      const sc = pageScaleRef.current || 1;
      setTextBoxes(prev => prev.map(tb =>
        tb.id === id ? { ...tb, x: origX + (e.clientX - startX) / sc, y: origY + (e.clientY - startY) / sc } : tb
      ));
    };
    const onUp = () => {
      const dr = dragRef.current;
      if (dr?.preDragTBs) {
        setTextBoxes(curr => {
          const moved = curr.find(t => t.id === dr.id);
          if (moved && (Math.abs(moved.x - dr.origX) > 1 || Math.abs(moved.y - dr.origY) > 1)) {
            undoStack.current.push({ textBoxes: dr.preDragTBs, editableShts: editableShtsRef.current });
            if (undoStack.current.length > 50) undoStack.current.shift();
            redoStack.current = [];
          }
          return curr;
        });
      }
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isEditing]);

  /* ── Drag-anything: only active when dragMode is ON ── */
  useEffect(() => {
    if (!dragMode) return;
    const container = printRef.current;
    if (!container) return;

    const THRESHOLD = 4;
    let state = null;

    const findTarget = (el) => {
      let node = el;
      while (node && node !== container) {
        if (node.dataset?.textbox) return null;
        if (node.classList?.contains('attendance-sheet-page')) return null;
        if (node.tagName === 'IMG')   return node;
        if (node.tagName === 'TR')    return node;
        if (node.tagName === 'TD' || node.tagName === 'TH') return node.closest('tr') || node;
        if (node.tagName === 'TABLE') return node;
        if (node.tagName === 'DIV') {
          const d = window.getComputedStyle(node).display;
          if (d === 'block' || d === 'flex' || d === 'grid') return node;
        }
        node = node.parentElement;
      }
      return null;
    };

    const onDown = (e) => {
      if (dragRef.current) return;
      const el = findTarget(e.target);
      if (!el) return;
      const m = new DOMMatrix(window.getComputedStyle(el).transform);
      state = { el, startX: e.clientX, startY: e.clientY,
                origX: isNaN(m.m41) ? 0 : m.m41,
                origY: isNaN(m.m42) ? 0 : m.m42, moved: false };
    };

    const onMove = (e) => {
      if (!state) return;
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      if (!state.moved) {
        if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
        state.moved = true;
        window.getSelection()?.removeAllRanges();
        state.el.style.position = 'relative';
        state.el.style.zIndex   = '5';
        state.el.style.cursor   = 'grabbing';
      }
      state.el.style.transform = `translate(${state.origX + dx}px,${state.origY + dy}px)`;
      e.preventDefault();
    };

    const onUp = () => {
      if (state?.el) state.el.style.cursor = '';
      state = null;
    };

    container.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      container.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [dragMode]);

  /* ── Scale A4 pages to fit screen (auto-fit unless user manually zoomed) ── */
  useEffect(() => {
    const update = () => {
      if (userZoomedRef.current) return;
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      setPageScale(Math.min(1, (w - 32) / 794));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const zoomIn  = () => { userZoomedRef.current = true; setPageScale(s => Math.min(2,   Math.round((s + 0.1) * 10) / 10)); };
  const zoomOut = () => { userZoomedRef.current = true; setPageScale(s => Math.max(0.25, Math.round((s - 0.1) * 10) / 10)); };

  useEffect(() => {
    api.get(`/allocations/${id}`)
      .then(res => {
        const alloc = res.data;
        setAllocation(alloc);
        const from = parseDate(alloc.fromDate);
        const to   = parseDate(alloc.toDate) || from;
        if (from && to) {
          setDateSessionMap(getInitialDateSessions(from, to, alloc.session));
          setCalMonth(from.getMonth());
          setCalYear(from.getFullYear());
          setShowDatePrompt(true);
        }
      })
      .catch(() => { toast.error('Failed to load allocation'); navigate('/attendance'); })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  /* Load saved draft from MongoDB when allocation is ready */
  useEffect(() => {
    if (!allocation || !id) return;
    api.get(`/drafts/${id}`)
      .then(res => {
        const parsed = res.data;
        if (parsed.editableShts) {
          parsed.editableShts = parsed.editableShts.map(s => ({
            ...s,
            dateCols: (s.dateCols || []).map(dc => ({ ...dc, date: new Date(dc.date) })),
          }));
        }
        if (parsed.timetableData && parsed.timetableData.length > 0) {
          setTimetableData(parsed.timetableData);
        }
        setDraft(parsed);
      })
      .catch(() => {}); // 404 = no draft, ignore
  }, [allocation, id]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: (() => {
      if (!allocation) return 'AttendanceSheet';
      const year  = allocation.year
        ? `${allocation.year} Year`
        : (allocation.yearSemester || '').split('/')[0].trim();
      const exam  = allocation.examName || '';
      const batch = (allocation.academicYear || '').replace(/-/g, '\u2013');
      return `${year} Attendance Sheet \u2013 ${exam} (${batch} Batch)`;
    })(),
  });

  /* ── Build sheet list ── */
  // ─── Row capacity per A4 page ───────────────────────────────────────
  //   A4 = 297mm.  Page padding: 12mm top + 10mm bottom = 275mm usable.
  //   5px (~1.3mm) safety margin → 273.7mm effective.
  //
  //   Header (SheetHeader, first page only) ≈ 37mm
  //   Table header (thead, every page)      ≈ 13mm
  //   Each student row (TD h=24px+pad+bdr)  ≈ 9.3mm
  //   Footer rows (last page: 4 summary + note) ≈ 42mm
  //   FIRST_LAST  = first+last page (header+footer+maybe TT)
  //   FIRST_ONLY  = first page only  (header, no footer)
  //   MID         = middle pages     (thead only)
  //   LAST_ONLY   = last page only   (footer+maybe TT, no header)
  // ────────────────────────────────────────────────────────────────────
  const hasTT = timetableData.length > 0;
  const ttDateCount = timetableData.length;

  // Per-page row capacities measured against the real rendered styles
  // (Playwright, headless Chromium) rather than estimated. The Subject-wise
  // Timetable's own height depends on how many exam dates it has (more
  // dates can force cells like the Timing row to wrap), so a page that
  // includes it doesn't have one fixed capacity — it was measured
  // separately per date count. Each value below is the true overflow
  // boundary minus a 2-row safety buffer for print-engine rounding.
  //
  // The 8-date column-starvation bug (colWidths() squeezing the Name
  // column to ~98px, wrapping every name) has been fixed at its source —
  // 8 now measures the same as 1-7 (re-verified after the fix), so it no
  // longer needs a special-cased lower value here.
  const trueMaxFirstLast = (n) => { // header + rows + footer + timetable, single page
    if (n <= 8) return 18;
    return 15; // 9+
  };
  const trueMaxLastOnly = (n) => { // footer + timetable, no header
    if (n <= 4) return 23;
    if (n <= 8) return 22;
    return 20; // 9+
  };

  // FIRST_LAST : single page containing both header and footer rows.
  // FIRST_ONLY : first page — header present, footer on next page.
  // MID        : middle pages — no header, no footer (full capacity).
  // LAST_ONLY  : last page — footer (+ optional timetable) present.
  // FIRST_LAST uses the true measured maximum directly (no safety buffer)
  // per explicit request — e.g. 18 for a 1-7 date timetable, not 16.
  const FIRST_LAST = hasTT ? trueMaxFirstLast(ttDateCount) : 23;
  const FIRST_ONLY = 26;
  const MID        = 31;
  const LAST_ONLY  = Math.max(1, (hasTT ? trueMaxLastOnly(ttDateCount) : 28) - 2);

  const buildSheets = () => {
    if (!allocation) return [];
    const dateCols = buildDateCols(dateSessionMap);
    const maxPerGroup = getMaxDateCols(dateCols.length);

    let hallMap;
    if (allocation.hasElectives) {
      hallMap = buildHallStudentsElective(allocation);
    } else {
      // nameMap may be null — buildHallStudentsStandard handles that by
      // generating blank rows from the hall plan (students fill in during exam).
      hallMap = buildHallStudentsStandard(allocation, nameMap, excelRows);
    }

    // Always use hallAllocations order — this is the hall plan, not seating.
    const hallOrder = (allocation.hallAllocations || []).map(h => h.hallName);

    const sheets = [];
    hallOrder.forEach(hallName => {
      const hallData = hallMap[hallName];
      if (!hallData) return;
      const { students, yearLabel } = hallData;

      // Split students into row chunks.
      //
      // Maximal packing: fill every page to its real capacity. A page's
      // capacity depends on whether it has to carry the header (first
      // page) and/or the footer/signature block (last page) — those eat
      // into the same vertical space as attendee rows. We only ever hold
      // rows back from a page when the footer genuinely can't fit
      // alongside all of them, and even then we hold back the bare
      // minimum (as few as 1 row) rather than padding the split evenly —
      // an almost-full page followed by a small final page is expected
      // and preferred over thinning out earlier pages.
      const rowPages = [];
      let offset = 0;
      const total = students.length;

      while (offset < total) {
        const remaining = total - offset;
        const isFirstPage = (offset === 0);
        const withFooterCap = isFirstPage ? FIRST_LAST : LAST_ONLY;
        const noFooterCap   = isFirstPage ? FIRST_ONLY : MID;

        let take;
        if (remaining <= withFooterCap) {
          // Everything left fits on one page, footer included — final page.
          take = remaining;
        } else if (remaining <= noFooterCap) {
          // Fits row-count-wise without a footer, but the footer needs a
          // page of its own since it won't fit alongside all these rows.
          // Pack this page as full as possible, leaving only the minimum
          // for a dedicated final page.
          take = remaining - 1;
        } else {
          // Still more than a single page can hold — fill to full capacity.
          take = noFooterCap;
        }

        rowPages.push(students.slice(offset, offset + take));
        offset += take;
      }

      // Now for each row chunk, split into date groups
      rowPages.forEach((pageStudents, pIdx) => {
        const dateGroups = [];
        for (let i = 0; i < Math.max(1, dateCols.length); i += maxPerGroup) {
          dateGroups.push(dateCols.slice(i, i + maxPerGroup));
        }

        dateGroups.forEach((group, gIdx) => {
          sheets.push({
            hallName,
            yearLabel,
            students: pageStudents,
            dateCols: group,
            // Only the absolute last page of the hall gets the footer
            isLastPage: (pIdx === rowPages.length - 1) && (gIdx === dateGroups.length - 1),
            // Only the very first page of the hall gets the college header
            isFirstPage: (pIdx === 0) && (gIdx === 0),
            dateGroupIdx: gIdx,
            totalDateGroups: dateGroups.length,
            totalDateCols: dateCols.length
          });
        });
      });
    });
    return sheets;
  };

  const sheets = buildSheets();
  // Sheets are always generated from the hall plan — no upload required.
  // For Standard allocations, nameMap is optional (pre-fills register numbers).
  const needsUpload = false;
  const [showOptionalUpload, setShowOptionalUpload] = useState(false);

  /* ── Row / Column editing helpers ── */
  // Always prefer editableShts if it exists — edits must survive toggling rowColMode off/on
  const displaySheets = editableShts || sheets;

  const toggleRowColMode = () => {
    if (!rowColMode && !editableShts) {
      // First time entering Row & Col mode: snapshot current sheets
      setEditableShts(sheets.map(s => ({
        ...s,
        students: s.students.map(st => ({ ...st })),
        dateCols: s.dateCols.map(dc => ({ ...dc })),
      })));
    }
    // If editableShts already exists (user toggled off/on), keep existing edits
    setRowColMode(v => !v);
  };

  const pushEditUndo = useCallback(() => {
    setEditableShts(cur => {
      undoStack.current.push({ textBoxes, editableShts: cur });
      if (undoStack.current.length > 50) undoStack.current.shift();
      redoStack.current = [];
      return cur;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textBoxes]);

  const rcAddRow = (sheetIdx) => {
    pushEditUndo();
    setEditableShts(prev => prev.map((s, i) => i !== sheetIdx ? s : {
      ...s, students: [...s.students, { registerNo: '', name: '', section: '', sNo: '' }],
    }));
  };

  const rcDeleteRow = (sheetIdx, rowIdx) => {
    pushEditUndo();
    setEditableShts(prev => prev.map((s, i) => i !== sheetIdx ? s : {
      ...s, students: s.students.filter((_, ri) => ri !== rowIdx),
    }));
  };

  const rcAddCol = (sheetIdx) => {
    pushEditUndo();
    setEditableShts(prev => prev.map((s, i) => {
      if (i !== sheetIdx) return s;
      const last = s.dateCols[s.dateCols.length - 1];
      const next = last ? new Date(last.date) : new Date();
      next.setDate(next.getDate() + 1);
      if (next.getDay() === 0) next.setDate(next.getDate() + 1);
      return { ...s, dateCols: [...s.dateCols, { date: next, session: last?.session || 'FN' }] };
    }));
  };

  const rcDeleteCol = (sheetIdx, colIdx) => {
    pushEditUndo();
    setEditableShts(prev => prev.map((s, i) => i !== sheetIdx ? s : {
      ...s, dateCols: s.dateCols.filter((_, ci) => ci !== colIdx),
    }));
  };

  const rcUpdateCell = (sheetIdx, rowIdx, field, value) =>
    setEditableShts(prev => prev.map((s, i) => i !== sheetIdx ? s : {
      ...s,
      students: s.students.map((st, ri) => ri !== rowIdx ? st : { ...st, [field]: value }),
    }));

  /* ── Draft helpers (persisted to MongoDB) ── */
  const serializeSave = (shts, tbs) => ({
    editableShts: shts.map(s => ({
      ...s,
      dateCols: s.dateCols.map(dc => ({
        ...dc,
        date: dc.date instanceof Date ? dc.date.toISOString() : dc.date,
      })),
    })),
    textBoxes: tbs,
    timetableData,
  });

  const saveDraft = async () => {
    const shts = editableShts || sheets;
    if (!shts.length) { toast.warn('Nothing to save yet'); return; }
    try {
      await api.put(`/drafts/${id}`, serializeSave(shts, textBoxes));
      toast.success('Draft saved permanently — restore anytime');
    } catch {
      toast.error('Failed to save draft');
    }
  };

  const restoreDraft = () => {
    if (!draft) return;
    setEditableShts(draft.editableShts);
    setTextBoxes(draft.textBoxes || []);
    if (draft.timetableData && draft.timetableData.length > 0) {
      setTimetableData(draft.timetableData);
    }
    setRowColMode(true);
    setIsEditing(true);
    setDraft(null);
    toast.success('Draft restored');
  };

  const discardDraft = async () => {
    try {
      await api.delete(`/drafts/${id}`);
    } catch {}
    setDraft(null);
  };

  const fmtDraftTime = (iso) => {
    const d = new Date(iso);
    const date = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    return `${date} at ${time}`;
  };

  /* Back button — intercepts when editing to offer save draft */
  const handleBack = () => {
    if (isEditing) { setShowBackModal(true); } else { navigate('/attendance'); }
  };

  const uniqueHalls = [...new Set(displaySheets.map(s => s.hallName))];

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-vh-100 d-flex justify-content-center align-items-center"
        style={{ backgroundColor:'#FAF7F9' }}>
        <div className="spinner-border" style={{ color:'#B42B6A' }} role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
      </div>
    );
  }
  if (!allocation) return null;

  return (
    <div style={{ background:'linear-gradient(135deg,#FAF7F9 0%,#FEF9FB 100%)', minHeight:'100vh', padding:'0 0 40px' }}>

      {/* ── Screen toolbar (no-print) ── */}
      <div className="no-print print-toolbar-outer" style={{ background: isEditing ? '#FDF2F7' : 'white', borderBottom:`1px solid ${isEditing?'rgba(180,43,106,0.18)':'#E8E2E5'}`, padding:'10px 16px', position:'sticky', top:0, zIndex:100, transition:'all 0.2s' }}>

        {/* Row 1 — left + exam name + right actions */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', flexWrap:'wrap' }}>

          {/* Left */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <button onClick={handleBack} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'7px 16px', borderRadius:'50px', border:'1.5px solid #E8E2E5', background:'white', color:'#444', fontWeight:'600', fontSize:'13px', cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,0.05)', whiteSpace:'nowrap' }}>
              <FiArrowLeft size={15} /> Back
            </button>
            {isEditing && (
              <span style={{ background:'linear-gradient(135deg,#FDF2F7,#FEF7FB)', border:'1px solid rgba(180,43,106,0.3)', borderRadius:'50px', padding:'5px 12px', fontSize:'11px', fontWeight:'700', color:'#B42B6A', display:'flex', alignItems:'center', gap:'5px', whiteSpace:'nowrap' }}>
                <FiEdit2 size={11} /> Editing
              </span>
            )}
          </div>

          {/* Center exam name */}
          <div style={{ textAlign:'center', flex:'1', minWidth:0 }}>
            <div style={{ fontWeight:'700', color:'#1B0A12', fontSize:'14px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{allocation.examName}</div>
            <div style={{ color:'#9B8F94', fontSize:'11px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {allocation.yearSemester} · {allocation.session} · {allocation.academicYear}
            </div>
          </div>

          {/* Right actions */}
          {!needsUpload && sheets.length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap', justifyContent:'flex-end' }}>
              {!isEditing ? (
                <>
                  <button onClick={() => setIsEditing(true)} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'50px', border:'1.5px solid #E8E2E5', background:'white', color:'#6B5E63', fontWeight:'600', fontSize:'13px', cursor:'pointer' }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='#B42B6A';e.currentTarget.style.color='#B42B6A';}} onMouseLeave={e=>{e.currentTarget.style.borderColor='#E8E2E5';e.currentTarget.style.color='#6B5E63';}}>
                    <FiEdit2 size={14} /> Edit
                  </button>
                  <button onClick={() => handlePrint()} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 18px', borderRadius:'50px', border:'none', background:'linear-gradient(135deg,#C43078,#B42B6A)', color:'white', fontWeight:'700', fontSize:'13px', cursor:'pointer', boxShadow:'0 4px 14px rgba(180,43,106,0.35)' }}>
                    <FiPrinter size={14} /> Print / PDF
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { setIsEditing(false); setDragMode(false); setRowColMode(false); setEditableShts(null); }} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'50px', border:'1.5px solid #E8E2E5', background:'white', color:'#6B5E63', fontWeight:'600', fontSize:'13px', cursor:'pointer' }}>
                    <FiXCircle size={14} /> Cancel
                  </button>
                  <button onClick={saveDraft} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'50px', border:'1.5px solid #217346', background:'white', color:'#217346', fontWeight:'700', fontSize:'13px', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#f0fdf4'} onMouseLeave={e=>e.currentTarget.style.background='white'}>
                    <FiSave size={14} /> Save Draft
                  </button>
                  <button onClick={() => { saveDraft(); handlePrint(); setIsEditing(false); setDragMode(false); setRowColMode(false); }} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 18px', borderRadius:'50px', border:'none', background:'linear-gradient(135deg,#B42B6A,#9A2259)', color:'white', fontWeight:'700', fontSize:'13px', cursor:'pointer', boxShadow:'0 4px 14px rgba(180,43,106,0.35)' }}>
                    <FiPrinter size={14} /> Save &amp; Print
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Row 2 — zoom controls centered */}
        {!needsUpload && sheets.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', marginTop:'10px', paddingTop:'10px', borderTop:'1px solid rgba(232,226,229,0.7)' }}>
            <div style={{ display:'flex', alignItems:'center', background:'white', border:'1.5px solid #E8E2E5', borderRadius:'50px', overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
              <button onClick={zoomOut} title="Zoom out" style={{ padding:'7px 16px', background:'none', border:'none', cursor:'pointer', color:'#6B5E63', fontSize:'18px', fontWeight:'700', lineHeight:1 }}
                onMouseEnter={e=>e.currentTarget.style.background='#FDF2F7'} onMouseLeave={e=>e.currentTarget.style.background='none'}>−</button>
              <span style={{ fontSize:'13px', fontWeight:'800', color:'#1B0A12', minWidth:'52px', textAlign:'center', userSelect:'none' }}>
                {Math.round(pageScale * 100)}%
              </span>
              <button onClick={zoomIn} title="Zoom in" style={{ padding:'7px 16px', background:'none', border:'none', cursor:'pointer', color:'#6B5E63', fontSize:'18px', fontWeight:'700', lineHeight:1 }}
                onMouseEnter={e=>e.currentTarget.style.background='#FDF2F7'} onMouseLeave={e=>e.currentTarget.style.background='none'}>+</button>
            </div>
          </div>
        )}

      </div>

      {/* ── Optional name upload banner (standard allocations only) ── */}
      {!allocation?.hasElectives && !nameMap && !showOptionalUpload && (
        <div className="no-print" style={{
          background: '#FFF7ED', borderBottom: '1px solid #FDE68A',
          padding: '10px 24px', display: 'flex', alignItems: 'center',
          gap: '12px', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '13px', color: '#92400E', fontWeight: '600' }}>
            Attendance sheet generated from hall plan — Register No & Name columns are blank.
          </span>
          <button
            onClick={() => setShowOptionalUpload(true)}
            style={{
              padding: '5px 16px', borderRadius: '50px', border: 'none',
              background: '#F59E0B', color: 'white', fontWeight: '700', fontSize: '12px',
              cursor: 'pointer', boxShadow: '0 2px 6px rgba(245,158,11,0.35)',
            }}
          >Upload Student Names (Optional)</button>
        </div>
      )}

      {/* ── Optional Excel upload panel (collapsible) ── */}
      {!allocation?.hasElectives && showOptionalUpload && (
        <div className="no-print" style={{ padding: '24px', maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontWeight: '700', color: '#1B0A12', fontSize: '15px' }}>
              Upload Student Names (Optional)
            </span>
            <button
              onClick={() => setShowOptionalUpload(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8F94', padding: '4px' }}
            >
              <FiX size={18} />
            </button>
          </div>
          <ExcelUpload
            expectedCount={allocation.totalStrength}
            onDataReady={(map, rows) => {
              if (allocation.totalStrength && map.size !== allocation.totalStrength) {
                toast.warn(
                  `Excel has ${map.size} student${map.size !== 1 ? 's' : ''} but allocation has ${allocation.totalStrength}. ` +
                  `Sheets will be generated with the data provided — verify your file if counts differ.`,
                  { autoClose: 6000 }
                );
              }
              setNameMap(map);
              setExcelRows(rows || null);
              setShowOptionalUpload(false);
            }}
          />
        </div>
      )}

      {/* ── Uploaded names banner ── */}
      {!allocation?.hasElectives && nameMap && (
        <div className="no-print" style={{
          background: '#F0FDF4', borderBottom: '1px solid #86EFAC',
          padding: '8px 24px', display: 'flex', alignItems: 'center',
          gap: '10px', flexWrap: 'wrap',
        }}>
          <FiCheckCircle size={14} color="#16A34A" />
          <span style={{ fontSize: '13px', color: '#15803D', fontWeight: '600' }}>
            {nameMap.size} student names loaded from Excel — register numbers pre-filled.
          </span>
          <button
            onClick={() => { setNameMap(null); setExcelRows(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8F94', padding: '2px 4px', fontSize: '12px' }}
          >Clear</button>
        </div>
      )}

      {/* ── Info bar ── */}
      {!needsUpload && sheets.length > 0 && (
        <div className="no-print" style={{
          background:'#FDF2F7', borderBottom:'1px solid rgba(180,43,106,0.15)',
          padding:'8px 24px', display:'flex', alignItems:'center', gap:'10px',
        }}>
          <FiFile size={14} color="#B42B6A" />
          <span style={{ fontSize:'13px', color:'#6B5E63' }}>
            <strong style={{ color:'#B42B6A' }}>{sheets.length} page{sheets.length!==1?'s':''}</strong>
            {' '}across{' '}
            <strong style={{ color:'#B42B6A' }}>{uniqueHalls.length} hall{uniqueHalls.length!==1?'s':''}</strong>
          </span>
        </div>
      )}

      {/* ── Draft restore banner ── */}
      {draft && !isEditing && (
        <div className="no-print" style={{
          background: '#FFFBEB', borderBottom: '1px solid #FDE68A',
          padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '12px',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '13px', color: '#92400E', fontWeight: '600' }}>
             Unsaved draft from {fmtDraftTime(draft.savedAt)}
          </span>
          <button
            onClick={restoreDraft}
            style={{
              padding: '5px 16px', borderRadius: '50px', border: 'none',
              background: '#F59E0B', color: 'white', fontWeight: '700', fontSize: '12px',
              cursor: 'pointer', boxShadow: '0 2px 6px rgba(245,158,11,0.35)',
            }}
          >Restore Draft</button>
          <button
            onClick={discardDraft}
            style={{
              padding: '5px 14px', borderRadius: '50px', border: '1px solid #FDE68A',
              background: 'transparent', color: '#92400E', fontWeight: '600', fontSize: '12px', cursor: 'pointer',
            }}
          >Dismiss</button>
        </div>
      )}

      {/* ── Mini editor toolbar (no-print, shown when editing) ── */}
      {!needsUpload && sheets.length > 0 && isEditing && (() => {
        const TB = {
          display:'flex', alignItems:'center', justifyContent:'center',
          minWidth:'28px', height:'28px', padding:'0 6px', borderRadius:'6px',
          border:'1px solid transparent', background:'transparent',
          cursor:'pointer', color:'#6B5E63', fontSize:'13px',
          fontFamily:'inherit', transition:'all 0.15s', userSelect:'none',
        };
        const tbHover = (e) => { e.currentTarget.style.background='#FDF2F7'; e.currentTarget.style.color='#B42B6A'; e.currentTarget.style.border='1px solid rgba(180,43,106,0.22)'; };
        const tbLeave = (e) => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#6B5E63'; e.currentTarget.style.border='1px solid transparent'; };
        const Sep = () => <div style={{ width:1, height:20, background:'#E8E2E5', margin:'0 4px', flexShrink:0 }} />;
        return (
          <div className="no-print print-editor-toolbar" style={{
            background:'white', border:'1.5px solid #E8E2E5', borderRadius:'12px',
            padding:'6px 12px', display:'flex', alignItems:'center', gap:'2px',
            flexWrap:'wrap', margin:'0 auto 10px', maxWidth:'100%',
            boxShadow:'0 2px 12px rgba(180,43,106,0.08)',
          }}>
            {/* Undo / Redo */}
            <button title="Undo (Ctrl+Z)" style={TB} onMouseDown={e=>{e.preventDefault();handleUndo();}} onMouseEnter={tbHover} onMouseLeave={tbLeave}><FiRotateCcw size={13}/></button>
            <button title="Redo (Ctrl+Y)" style={TB} onMouseDown={e=>{e.preventDefault();handleRedo();}} onMouseEnter={tbHover} onMouseLeave={tbLeave}><FiRotateCw size={13}/></button>
            <Sep />
            {[
              { label:<b style={{fontFamily:'Georgia,serif',fontSize:'14px'}}>B</b>, cmd:'bold',        title:'Bold (Ctrl+B)' },
              { label:<i style={{fontFamily:'Georgia,serif',fontSize:'14px'}}>I</i>,  cmd:'italic',      title:'Italic (Ctrl+I)' },
              { label:<u style={{fontSize:'13px'}}>U</u>,                              cmd:'underline',   title:'Underline (Ctrl+U)' },
              { label:<s style={{fontSize:'13px'}}>S</s>,                              cmd:'strikeThrough',title:'Strikethrough' },
            ].map(({ label, cmd, title }) => (
              <button key={cmd} title={title} style={TB}
                onMouseDown={e => { e.preventDefault(); fmt(cmd); }}
                onMouseEnter={tbHover} onMouseLeave={tbLeave}>
                {label}
              </button>
            ))}

            <Sep />

            <select
              title="Font Size"
              onMouseDown={e => e.stopPropagation()}
              onChange={e => { document.execCommand('fontSize', false, e.target.value); }}
              style={{ height:'28px', borderRadius:'6px', border:'1px solid #E8E2E5', padding:'0 4px', fontSize:'12px', color:'#6B5E63', cursor:'pointer', background:'white' }}
            >
              <option value="1">8pt</option>
              <option value="2">10pt</option>
              <option value="3" defaultValue>12pt</option>
              <option value="4">14pt</option>
              <option value="5">18pt</option>
              <option value="6">24pt</option>
              <option value="7">32pt</option>
            </select>

            <Sep />

            <label title="Text Colour" style={{ ...TB, position:'relative', overflow:'hidden', cursor:'pointer' }}
              onMouseEnter={tbHover} onMouseLeave={tbLeave}>
              <span style={{ fontWeight:'700', fontSize:'13px', borderBottom:'2.5px solid #B42B6A', lineHeight:1 }}>A</span>
              <input type="color" defaultValue="#000000"
                onChange={e => { document.execCommand('foreColor', false, e.target.value); }}
                style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%', height:'100%' }} />
            </label>

            <label title="Highlight" style={{ ...TB, position:'relative', overflow:'hidden', cursor:'pointer' }}
              onMouseEnter={tbHover} onMouseLeave={tbLeave}>
              <span style={{ fontWeight:'700', fontSize:'12px', background:'#FDE68A', padding:'1px 3px', borderRadius:'2px' }}>H</span>
              <input type="color" defaultValue="#FFFF88"
                onChange={e => { document.execCommand('backColor', false, e.target.value); }}
                style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%', height:'100%' }} />
            </label>

            <Sep />

            {[
              { Icon:FiAlignLeft,   cmd:'justifyLeft',   title:'Align Left' },
              { Icon:FiAlignCenter, cmd:'justifyCenter', title:'Centre' },
              { Icon:FiAlignRight,  cmd:'justifyRight',  title:'Align Right' },
            ].map(({ Icon, cmd, title }) => (
              <button key={cmd} title={title} style={TB}
                onMouseDown={e => { e.preventDefault(); fmt(cmd); }}
                onMouseEnter={tbHover} onMouseLeave={tbLeave}>
                <Icon size={14} />
              </button>
            ))}

            <Sep />

            <button
              title="Add floating text box"
              onMouseDown={e => { e.preventDefault(); addTextBox(); }}
              style={{ ...TB, gap:'5px', padding:'0 10px', fontSize:'12px', fontWeight:'600' }}
              onMouseEnter={tbHover} onMouseLeave={tbLeave}>
              <FiType size={13} /> + Text Box
            </button>

            <Sep />

            {/* Drag & Drop toggle */}
            <button
              title={dragMode ? 'Disable Drag & Drop' : 'Enable Drag & Drop'}
              onMouseDown={e => { e.preventDefault(); setDragMode(v => !v); }}
              style={{
                ...TB, gap:'5px', padding:'0 12px', fontSize:'12px', fontWeight:'700',
                background: dragMode ? '#B42B6A' : 'transparent',
                color:      dragMode ? 'white'   : '#6B5E63',
                border:     dragMode ? '1px solid #B42B6A' : '1px solid transparent',
              }}
            >
              <FiMove size={13} /> {dragMode ? 'Drag ON' : 'Drag & Drop'}
            </button>

            <Sep />

            {/* Row & Column edit toggle */}
            <button
              title={rowColMode ? 'Close Excel editor' : 'Open Excel row/column editor'}
              onMouseDown={e => { e.preventDefault(); toggleRowColMode(); }}
              style={{
                ...TB, gap:'5px', padding:'0 12px', fontSize:'12px', fontWeight:'700',
                background: rowColMode ? '#217346' : 'transparent',
                color:      rowColMode ? 'white'   : '#6B5E63',
                border:     rowColMode ? '1px solid #1a5c38' : '1px solid transparent',
              }}
            >
              <FiGrid size={13} /> {rowColMode ? 'Excel ON' : 'Row & Col'}
            </button>
          </div>
        );
      })()}

      {/* ── Main content area ── */}
      {!needsUpload && sheets.length > 0 && (
        <>
          {/* Mini Excel editor — screen-only, shown when rowColMode is ON */}
          {rowColMode && (
            <div className="no-print" style={{ padding: '16px 24px' }}>
              {displaySheets.map((sheet, idx) => (
                <MiniExcelGrid
                  key={idx}
                  sheet={sheet}
                  sheetIdx={idx}
                  onAddRow={() => rcAddRow(idx)}
                  onDeleteRow={(ri) => rcDeleteRow(idx, ri)}
                  onAddCol={() => rcAddCol(idx)}
                  onDeleteCol={(ci) => rcDeleteCol(idx, ci)}
                  onCellChange={(ri, field, val) => rcUpdateCell(idx, ri, field, val)}
                />
              ))}
            </div>
          )}

          {/* Printable A4 pages — always in DOM so printing works.
              Hidden from screen while the Excel editor is open. */}
          <div ref={containerRef} className="print-page-outer" style={{ padding: '24px 16px', ...(rowColMode ? { display: 'none' } : {}) }}>
            <div ref={printRef} className="print-ref-inner" style={{ position: 'relative', width: '210mm', zoom: pageScale, margin: '0 auto' }}>
              {displaySheets.map((sheet, idx) => (
                <div
                  key={idx}
                  className="attendance-sheet-page"
                  contentEditable={isEditing}
                  suppressContentEditableWarning={true}
                  style={{
                    width: '210mm',
                    minHeight: '297mm',
                    background: 'white',
                    boxShadow: isEditing
                      ? '0 0 0 2px #B42B6A, 0 8px 40px rgba(0,0,0,0.12)'
                      : '0 8px 40px rgba(0,0,0,0.12)',
                    borderRadius: '4px',
                    margin: '0 0 20px',
                    boxSizing: 'border-box',
                    overflow: 'visible',
                    outline: 'none',
                    cursor: dragMode ? 'grab' : 'default',
                    transition: 'box-shadow 0.2s',
                  }}
                >
                  <AttendanceSheetPage
                    allocation={allocation}
                    hallName={sheet.hallName}
                    yearLabel={sheet.yearLabel}
                    students={sheet.students}
                    dateCols={sheet.dateCols}
                    isLastPage={sheet.isLastPage}
                    isFirstPage={sheet.isFirstPage}
                    timetableData={timetableData}
                  />
                </div>
              ))}

              {/* ── Floating text boxes ── */}
              {textBoxes.map(tb => (
                <div
                  key={tb.id}
                  data-textbox="1"
                  style={{
                    position:'absolute', left:tb.x, top:tb.y,
                    minWidth:'120px', minHeight:'32px',
                    border: isEditing ? '1.5px dashed #B42B6A' : 'none',
                    background:'white', zIndex:20, borderRadius:'3px',
                    boxShadow: isEditing ? '0 2px 10px rgba(180,43,106,0.18)' : 'none',
                    cursor: isEditing ? 'move' : 'default',
                  }}
                  onMouseDown={e => { if (!isEditing) return; e.stopPropagation(); startDrag(e, tb); }}
                >
                  {isEditing && (
                    <button
                      className="no-print"
                      onClick={e => { e.stopPropagation(); setTextBoxes(prev => { undoStack.current.push({ textBoxes: prev, editableShts: editableShts }); redoStack.current = []; return prev.filter(t => t.id !== tb.id); }); }}
                      onMouseDown={e => e.stopPropagation()}
                      style={{
                        position:'absolute', top:-10, right:-10,
                        width:20, height:20, borderRadius:'50%',
                        border:'none', background:'#B42B6A', color:'white',
                        fontSize:'14px', lineHeight:1, cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        boxShadow:'0 1px 4px rgba(0,0,0,0.25)',
                      }}
                    >×</button>
                  )}
                  <div
                    contentEditable={isEditing ? 'true' : 'false'}
                    suppressContentEditableWarning={true}
                    onMouseDown={e => e.stopPropagation()}
                    onBlur={e => { const h = e.currentTarget.innerHTML; setTextBoxes(p => p.map(t => t.id === tb.id ? { ...t, html: h } : t)); }}
                    dangerouslySetInnerHTML={{ __html: tb.html || '' }}
                    style={{
                      padding:'6px 10px', minHeight:'28px',
                      fontFamily:PRINT_FONT, fontSize:'10pt', fontWeight:'bold',
                      outline:'none', cursor:'text', whiteSpace:'pre-wrap',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Empty fallback ── */}
      {!needsUpload && sheets.length === 0 && (
        <div className="no-print" style={{ padding:'60px 24px', textAlign:'center' }}>
          <p style={{ color:'#9B8F94', fontSize:'16px' }}>No hall data found for this allocation.</p>
        </div>
      )}

      {/* ── Date Selection Modal ── */}
      {showDatePrompt && (() => {
        const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
        const getFirstDayOfMonth = (year, month) => {
          const d = new Date(year, month, 1).getDay();
          return d === 0 ? 6 : d - 1; // 0=Monday, ..., 6=Sunday
        };
        const daysInMonth = getDaysInMonth(calYear, calMonth);
        const emptyCells = getFirstDayOfMonth(calYear, calMonth);
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        
        const defSession = defaultSessionFor(allocation.session);

        const handleDateTap = (dateStr) => {
          // First tap on unselected date: add with default session.
          // Tap on selected date: open popup to edit/clear.
          if (!dateSessionMap[dateStr]) {
            setDateSessionMap(prev => ({ ...prev, [dateStr]: defSession }));
            setSessionPopupDate(dateStr);
          } else {
            setSessionPopupDate(prev => (prev === dateStr ? null : dateStr));
          }
        };

        const setSession = (dateStr, sess) => {
          setDateSessionMap(prev => ({ ...prev, [dateStr]: sess }));
        };

        const clearDate = (dateStr) => {
          setDateSessionMap(prev => {
            const next = { ...prev };
            delete next[dateStr];
            return next;
          });
          setSessionPopupDate(null);
        };

        const minTime = parseDate(allocation.fromDate)?.getTime() || 0;
        const maxTime = allocation.toDate ? parseDate(allocation.toDate).getTime() : minTime;

        return (
          <div style={{
            position:'fixed', inset:0, zIndex:2000,
            background:'rgba(27,10,18,0.6)', backdropFilter:'blur(4px)',
            display:'flex', alignItems:'center', justifyContent:'center', padding:'16px',
          }}>
            <div className="date-modal-scroll" style={{
              background:'white', borderRadius:'22px',
              width:'100%', maxWidth:'420px',
              maxHeight:'90vh', overflowY:'auto',
              scrollbarWidth:'none', msOverflowStyle:'none',
              boxShadow:'0 24px 64px rgba(27,10,18,0.22)',
              animation:'slideUp 0.22s cubic-bezier(0.34,1.4,0.64,1)',
            }}>
              {/* Header */}
              <div style={{ background:'linear-gradient(135deg,#FDF2F7,#FEF7FB)', borderBottom:'1px solid rgba(180,43,106,0.18)', padding:'22px 22px 16px', textAlign:'center' }}>
                <div style={{ display:'inline-flex', background:'rgba(180,43,106,0.12)', padding:'8px', borderRadius:'50%', marginBottom:'10px', width:'52px', height:'52px', alignItems:'center', justifyContent:'center' }}>
                  <img src="/psna2logo.png" alt="PSNA" style={{ width:'36px', height:'36px', objectFit:'contain', borderRadius:'50%' }} />
                </div>
                <h4 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:'18px', fontWeight:'800', color:'#1B0A12', margin:'0 0 5px' }}>
                  Select Exam Dates
                </h4>
                <p style={{ color:'#B42B6A', fontSize:'12px', margin:0, fontWeight:'600' }}>
                  Tap a date, then choose FN / AN / Both
                </p>
              </div>

              {/* Calendar Body */}
              <div style={{ padding:'20px 24px' }} onClick={() => {
                // Close popup when tapping anywhere in the calendar body
                setSessionPopupDate(null);
              }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <button type="button" onClick={() => {
                    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
                    else setCalMonth(calMonth - 1);
                  }} className="btn btn-light rounded-circle p-2 d-flex align-items-center">
                    <FiChevronLeft size={16} />
                  </button>
                  <span className="fw-bold" style={{ color: '#2D1F26', fontSize: '15px' }}>
                    {monthNames[calMonth]} {calYear}
                  </span>
                  <button type="button" onClick={() => {
                    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
                    else setCalMonth(calMonth + 1);
                  }} className="btn btn-light rounded-circle p-2 d-flex align-items-center">
                    <FiChevronRight size={16} />
                  </button>
                </div>

                <div className="d-grid gap-1 mb-2 text-center" style={{ gridTemplateColumns: 'repeat(7, 1fr)', fontSize: '12px', fontWeight: 'bold', color: '#9B8F94' }}>
                  {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => <div key={d}>{d}</div>)}
                </div>

                <div className="d-grid gap-1 text-center" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
                  {Array.from({ length: emptyCells }).map((_, i) => <div key={`empty-${i}`} />)}

                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dTime = new Date(calYear, calMonth, day).getTime();
                    const dObj = new Date(calYear, calMonth, day);
                    const dateStr = toDateString(dObj);

                    const isDisabled = minTime && (dTime < minTime || dTime > maxTime);
                    const sess = dateSessionMap[dateStr];
                    const isSelected = !!sess;
                    const isPopupOpen = sessionPopupDate === dateStr;
                    const cellIndex = emptyCells + i;
                    const row = Math.floor(cellIndex / 7);
                    const popupAbove = row > 0; // first row → popup below, others → popup above

                    const CELL = 36;
                    let background = '#FAFAFA';
                    let color = '#1B0A12';
                    let border = '1px solid #E8E2E5';
                    let opacity = 1;

                    if (isDisabled) { opacity = 0.3; }
                    else if (sess === 'BOTH') {
                      background = '#B42B6A';
                      color = 'white'; border = 'none';
                    } else if (sess === 'FN') {
                      // Left half filled
                      background = 'linear-gradient(to right, #B42B6A 50%, #FDF2F7 50%)';
                      color = '#1B0A12'; border = '1.5px solid #B42B6A';
                    } else if (sess === 'AN') {
                      background = 'linear-gradient(to right, #FDF2F7 50%, #B42B6A 50%)';
                      color = '#1B0A12'; border = '1.5px solid #B42B6A';
                    }

                    // Compute column position for edge-aware popover placement
                    const colIndex = cellIndex % 7;
                    const isLeftEdge  = colIndex <= 1;
                    const isRightEdge = colIndex >= 5;

                    // Determine vertical position: last row → above, first row → below
                    const totalRows = Math.ceil((emptyCells + daysInMonth) / 7);
                    const isLastRow = row === totalRows - 1;
                    const popupGoesAbove = popupAbove || isLastRow;

                    return (
                      <div key={day} className="py-1" style={{ position: 'relative' }}>
                        <div
                          onClick={(e) => { e.stopPropagation(); !isDisabled && handleDateTap(dateStr); }}
                          style={{
                            width: `${CELL}px`, height: `${CELL}px`,
                            borderRadius: '50%',
                            background, color, border, opacity,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: 'auto',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            fontSize: '14px', fontWeight: sess ? '700' : '500',
                            transition: 'transform 0.15s, box-shadow 0.15s',
                            boxShadow: isPopupOpen ? '0 0 0 3px rgba(180,43,106,0.25)' : (sess === 'BOTH' ? '0 2px 8px rgba(180,43,106,0.35)' : 'none'),
                            transform: isPopupOpen ? 'scale(1.08)' : 'none',
                            position: 'relative', zIndex: isPopupOpen ? 3 : 1,
                          }}
                        >
                          {day}
                          {isSelected && sess !== 'BOTH' && (
                            <span style={{
                              position: 'absolute', bottom: '-14px', left: '50%', transform: 'translateX(-50%)',
                              fontSize: '8px', fontWeight: '800', color: '#B42B6A', letterSpacing: '0.5px',
                            }}>{sess}</span>
                          )}
                        </div>

                        {isPopupOpen && (
                          <div
                            data-session-popup="1"
                            onClick={e => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              ...(popupGoesAbove
                                ? { bottom: 'calc(100% + 6px)' }
                                : { top: 'calc(100% + 6px)' }),
                              ...(isLeftEdge
                                ? { left: '0' }
                                : isRightEdge
                                  ? { right: '0' }
                                  : { left: '50%', transform: 'translateX(-50%)' }),
                              background: 'white',
                              border: '1.5px solid rgba(180,43,106,0.25)',
                              borderRadius: '14px',
                              boxShadow: '0 12px 32px rgba(27,10,18,0.22), 0 0 0 1px rgba(180,43,106,0.08)',
                              padding: '6px',
                              display: 'flex', gap: '4px',
                              zIndex: 50,
                              animation: 'popupPop 0.15s cubic-bezier(0.34,1.56,0.64,1)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {['FN', 'AN', 'BOTH'].map(opt => {
                              const active = sess === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={e => { e.stopPropagation(); setSession(dateStr, opt); setSessionPopupDate(null); }}
                                  style={{
                                    background: active ? 'linear-gradient(135deg,#B42B6A,#9A2259)' : '#FAF7F9',
                                    color: active ? 'white' : '#6B5E63',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '5px 9px',
                                    fontSize: '10px',
                                    fontWeight: '800',
                                    letterSpacing: '0.5px',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                  }}
                                >{opt}</button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); clearDate(dateStr); }}
                              title="Remove date"
                              style={{
                                background: '#FEE2E2', color: '#B91C1C',
                                border: 'none', borderRadius: '8px',
                                padding: '5px 7px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center',
                              }}
                            ><FiX size={12} /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Timetable Upload Section ── */}
              <div style={{ padding:'0 24px 16px' }}>
                <div style={{ borderTop:'1px solid #E8E2E5', paddingTop:'16px', marginBottom:'12px' }}>
                  <h5 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:'15px', fontWeight:'700', color:'#1B0A12', margin:'0 0 6px' }}>
                    Upload Subject-wise Timetable (CSE Only)
                  </h5>
                  <p style={{ color:'#9B8F94', fontSize:'12px', margin:'0 0 12px', lineHeight:'1.5' }}>
                    Upload an Excel/CSV timetable file. CSE subjects with dates and timings will be extracted automatically.
                  </p>

                  {!timetableData.length ? (
                    <div
                      onClick={() => ttFileRef.current?.click()}
                      style={{
                        border:'2px dashed #E8E2E5', borderRadius:'12px', padding:'18px 14px',
                        textAlign:'center', cursor:'pointer', background:'#FAF7F9',
                        transition:'all 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor='#B42B6A'; e.currentTarget.style.background='#FDF2F7'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor='#E8E2E5'; e.currentTarget.style.background='#FAF7F9'; }}
                    >
                      <input ref={ttFileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }}
                        onChange={e => { if (e.target.files[0]) handleTimetableUpload(e.target.files[0]); }} />
                      {ttUploading ? (
                        <div className="spinner-border spinner-border-sm" style={{ color:'#B42B6A' }} role="status">
                          <span className="visually-hidden">Processing...</span>
                        </div>
                      ) : (
                        <>
                          <FiUploadCloud size={24} color="#9B8F94" style={{ marginBottom:'6px' }} />
                          <p style={{ color:'#6B5E63', fontWeight:'600', fontSize:'13px', margin:'0 0 2px' }}>
                            Click to upload timetable
                          </p>
                          <p style={{ color:'#9B8F94', fontSize:'11px', margin:0 }}>.xlsx, .xls, .csv</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      background:'#F0FDF4', border:'1.5px solid #86EFAC', borderRadius:'12px',
                      padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px',
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <FiCheckCircle size={18} color="#16A34A" />
                        <div>
                          <div style={{ fontWeight:'700', color:'#1B0A12', fontSize:'13px' }}>{ttFile?.name}</div>
                          <div style={{ color:'#16A34A', fontSize:'12px', fontWeight:'600' }}>
                            {timetableData.length} subject{timetableData.length !== 1 ? 's' : ''} extracted
                          </div>
                        </div>
                      </div>
                      <button onClick={clearTimetable} style={{ background:'none', border:'none', cursor:'pointer', color:'#9B8F94', padding:'4px' }}>
                        <FiX size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Action */}
              <div style={{ padding:'0 24px 24px' }}>
                <button
                  onClick={() => { setSessionPopupDate(null); setShowDatePrompt(false); }}
                  style={{ width:'100%', padding:'12px', borderRadius:'50px', border:'none', background:'linear-gradient(135deg,#B42B6A,#9A2259)', color:'white', fontWeight:'700', fontSize:'14px', cursor:'pointer', boxShadow:'0 4px 14px rgba(180,43,106,0.35)' }}
                >
                  {timetableData.length > 0 ? 'Continue with Timetable' : 'Confirm Selection'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Back / Leave confirmation modal ── */}
      {showBackModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(27,10,18,0.55)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        }}>
          <div style={{
            background: 'white', borderRadius: '20px', padding: '32px',
            maxWidth: '440px', width: '100%',
            boxShadow: '0 24px 64px rgba(27,10,18,0.22)',
            animation: 'slideUp 0.2s ease',
          }}>
            {/* Icon */}
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: '#FDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '16px',
            }}>
              <FiArrowLeft size={22} color="#B42B6A" />
            </div>

            <h3 style={{
              fontFamily: "'Playfair Display',Georgia,serif",
              fontWeight: '800', fontSize: '20px', color: '#1B0A12', margin: '0 0 8px',
            }}>Leave without saving?</h3>
            <p style={{ color: '#6B5E63', fontSize: '14px', lineHeight: '1.6', margin: '0 0 24px' }}>
              You have unsaved edits. Choose what to do before leaving:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Save Draft → go back */}
              <button
                onClick={() => {
                  saveDraft();
                  setShowBackModal(false);
                  setIsEditing(false); setDragMode(false); setRowColMode(false);
                  navigate('/attendance');
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '14px 20px', borderRadius: '12px', border: '2px solid #217346',
                  background: '#f0fdf4', color: '#1a5c38', fontWeight: '700', fontSize: '14px',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <FiSave size={18} />
                <div>
                  <div style={{ fontWeight: '700' }}>Save Draft &amp; Leave</div>
                  <div style={{ fontSize: '12px', fontWeight: '400', color: '#4B7A5E' }}>
                    Changes are saved permanently — restore anytime
                  </div>
                </div>
              </button>

              {/* Discard → go back */}
              <button
                onClick={async () => {
                  try { await api.delete(`/drafts/${id}`); } catch {}
                  setShowBackModal(false);
                  setIsEditing(false); setDragMode(false); setRowColMode(false); setEditableShts(null);
                  navigate('/attendance');
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '14px 20px', borderRadius: '12px', border: '2px solid #FCA5A5',
                  background: '#FEF2F2', color: '#991B1B', fontWeight: '700', fontSize: '14px',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <FiXCircle size={18} />
                <div>
                  <div style={{ fontWeight: '700' }}>Discard &amp; Leave</div>
                  <div style={{ fontSize: '12px', fontWeight: '400', color: '#B91C1C' }}>
                    All unsaved changes will be permanently lost
                  </div>
                </div>
              </button>

              {/* Stay */}
              <button
                onClick={() => setShowBackModal(false)}
                style={{
                  padding: '12px 20px', borderRadius: '12px', border: '1.5px solid #E8E2E5',
                  background: 'white', color: '#6B5E63', fontWeight: '600', fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Continue Editing
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .date-modal-scroll::-webkit-scrollbar {
          display: none;
        }
        @keyframes popupPop {
          0%   { transform: scale(0.85); opacity: 0; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print, .print-toolbar-outer, .print-editor-toolbar {
            display: none !important;
          }
          .print-page-outer {
            padding: 0 !important;
          }
          .print-ref-inner {
            zoom: 1 !important;
            margin: 0 !important;
            width: 210mm !important;
          }
          [data-textbox] {
            border: none !important;
            box-shadow: none !important;
          }
          .attendance-sheet-page {
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            width: 210mm !important;
            /* Hard-clamp to A4 in print: React-side buildSheets() is the
               sole source of pagination truth. Without max-height the
               print engine reflows tall sheets across multiple physical
               pages, producing orphan rows that don't appear in preview.
               Row capacity is already reserved (LAST_ONLY=17 when a
               timetable is present) so content fits within 297mm. */
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .attendance-sheet-inner {
            height: 297mm !important;
            max-height: 297mm !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }
          .attendance-sheet-page * {
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .attendance-sheet-page:last-child {
            page-break-after: auto;
          }
          /* Keep timetable section together — if the remaining space on
             the current page is insufficient, the whole block is moved
             to a new page rather than splitting or clipping. The bottom
             margin guarantees breathing room from the page edge. */
          .timetable-inline-section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-before: auto !important;
            margin-bottom: 8px !important;
            padding-bottom: 2px !important;
            color: #000 !important;
          }
          .subject-timetable {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          /* High-contrast print styling for the subject-wise timetable */
          .subject-timetable {
            border: 2px solid #000 !important;
            background: #fff !important;
            color: #000 !important;
            table-layout: auto !important;
            width: 100% !important;
          }
          .subject-timetable td,
          .subject-timetable th {
            border: 2px solid #000 !important;
            background: #fff !important;
            color: #000 !important;
            font-weight: 800 !important;
            word-break: break-word !important;
            overflow-wrap: break-word !important;
            white-space: normal !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .subject-timetable td.tt-head,
          .subject-timetable th.tt-head {
            background: #d9dcdf !important;
            font-weight: 900 !important;
          }
          /* Prevent rows from being split across pages */
          tr {
            page-break-inside: avoid !important;
          }
          /* Repeat table headers on new pages */
          thead {
            display: table-header-group;
          }
        }
      `}</style>
    </div>
  );
};

export default AttendancePrint;
