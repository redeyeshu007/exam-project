const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { protect } = require('../middleware/auth');
const logger = require('../logger');

// Store uploads in memory (no disk persistence needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
    ];
    if (allowed.includes(file.mimetype) || /\.(xlsx|xls|csv)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported format'));
    }
  },
});

/* ── Helpers ─────────────────────────────────────────────────────── */

/** Check if a header / value looks like CSE */
const isCSE = (s) => {
  if (!s) return false;
  const v = String(s).trim().toUpperCase();
  return v === 'CSE' || v === 'COMPUTER SCIENCE AND ENGINEERING' || v === 'COMPUTER SCIENCE';
};

/** Normalise a date value coming from Excel into YYYY-MM-DD */
const normaliseDate = (raw) => {
  if (!raw) return null;

  // Excel serial date number
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }

  const s = String(raw).trim();

  // DD-Mon  (e.g. 18-Oct, 19-Oct) — assume current/next academic year
  const ddMon = s.match(/^(\d{1,2})[/-]([A-Za-z]{3,})$/);
  if (ddMon) {
    const months = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
    const m = months[ddMon[2].toLowerCase().slice(0, 3)];
    if (m !== undefined) {
      const day = parseInt(ddMon[1], 10);
      const now = new Date();
      let year = now.getFullYear();
      const candidate = new Date(year, m, day);
      if (candidate < now) year++;
      return `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy) {
    const yy = dmy[3].length === 2 ? '20' + dmy[3] : dmy[3];
    return `${yy}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  // YYYY-MM-DD (already ISO)
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  // Try JS Date as last resort
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return null;
};

/** Normalise a time string */
const normaliseTime = (raw) => {
  if (!raw) return '';
  let s = String(raw).trim();
  // "09-11" or "09–11" → "09:00–11:00 AM"
  const range = s.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})$/);
  if (range) {
    const from = parseInt(range[1], 10);
    const to = parseInt(range[2], 10);
    const fmtHr = (h) => {
      const suffix = h >= 12 ? 'PM' : 'AM';
      return `${String(h).padStart(2, '0')}:00 ${suffix}`;
    };
    return `${fmtHr(from)}–${fmtHr(to)}`;
  }
  return s;
};

/* ── Route: POST /api/timetable/upload ──────────────────────────── */
router.post('/upload', protect, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'No valid timetable extracted' });
    }

    const headers = Object.keys(rows[0]);
    const results = [];

    const dateCol = headers.find(h => /date/i.test(h));
    const timeCol = headers.find(h => /time|timing|slot/i.test(h));
    const subjectCol = headers.find(h => /subject|sub|paper|course/i.test(h));
    const cseCol = headers.find(h => isCSE(h));
    const deptCol = headers.find(h => /dept|department|branch/i.test(h));

    /* ── Strategy 0: Simple format — Date | Time | Subject ────────
       No CSE/dept column needed; all rows are treated as CSE data.
       Also handles files with a dept column (filters CSE rows only).
    ────────────────────────────────────────────────────────────── */
    if (dateCol && subjectCol) {
      rows.forEach(row => {
        // If there IS a department column, only keep CSE rows
        if (deptCol && !isCSE(row[deptCol])) return;

        const subject = String(row[subjectCol]).trim();
        if (!subject || subject === '-') return;

        const date = normaliseDate(row[dateCol]);
        if (!date) return;

        results.push({
          date,
          time: normaliseTime(row[timeCol] || ''),
          subject,
        });
      });
    }

    /* ── Strategy 1: Row-based with CSE column as subject source ──
       Columns like: date | time | CSE
    ────────────────────────────────────────────────────────────── */
    if (results.length === 0 && dateCol && cseCol) {
      rows.forEach(row => {
        const subject = String(row[cseCol]).trim();
        if (!subject || subject === '-') return;

        const date = normaliseDate(row[dateCol]);
        if (!date) return;

        results.push({
          date,
          time: normaliseTime(row[timeCol] || ''),
          subject,
        });
      });
    }

    /* ── Strategy 2: Column-based / transposed format ─────────────
       Row 0 (or header): dates across columns
       Row with "time/timing": timing values
       Row with "CSE": subject codes
    ────────────────────────────────────────────────────────────── */
    if (results.length === 0) {
      // Re-read as array-of-arrays for positional access
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (aoa.length >= 2) {
        // Find the row that contains dates (first row with parseable dates in columns 1+)
        let dateRowIdx = -1;
        let timeRowIdx = -1;
        let cseRowIdx = -1;

        for (let r = 0; r < Math.min(aoa.length, 20); r++) {
          const firstCell = String(aoa[r][0] || '').trim().toLowerCase();
          if (firstCell === 'date' || firstCell === 'dates') dateRowIdx = r;
          if (/^time|^timing|^slot/.test(firstCell)) timeRowIdx = r;
          if (isCSE(aoa[r][0])) cseRowIdx = r;

          // Also check if most cells in this row parse as dates
          if (dateRowIdx === -1) {
            let dateCount = 0;
            for (let c = 1; c < aoa[r].length; c++) {
              if (normaliseDate(aoa[r][c])) dateCount++;
            }
            if (dateCount >= 2) dateRowIdx = r;
          }
        }

        // If we found date row + CSE row, extract column by column
        if (dateRowIdx >= 0 && cseRowIdx >= 0) {
          const dateRow = aoa[dateRowIdx];
          const cseRow = aoa[cseRowIdx];
          const timeRow = timeRowIdx >= 0 ? aoa[timeRowIdx] : null;

          for (let c = 1; c < dateRow.length; c++) {
            const subject = String(cseRow[c] || '').trim();
            if (!subject || subject === '-') continue;

            const date = normaliseDate(dateRow[c]);
            if (!date) continue;

            results.push({
              date,
              time: timeRow ? normaliseTime(timeRow[c]) : '',
              subject,
            });
          }
        }
      }
    }

    if (results.length === 0) {
      return res.status(400).json({ success: false, message: 'CSE data not found in file' });
    }

    // Sort by date
    results.sort((a, b) => a.date.localeCompare(b.date));

    logger.info('Timetable parsed', { entries: results.length, ip: req.ip });
    res.json({ success: true, data: results });
  } catch (err) {
    logger.error('Timetable upload failed', { message: err.message, stack: err.stack, ip: req.ip });
    if (err.message === 'Unsupported format') {
      return res.status(400).json({ success: false, message: 'Unsupported format' });
    }
    res.status(500).json({ success: false, message: 'Failed to process timetable file' });
  }
});

module.exports = router;
