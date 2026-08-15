import { useState } from 'react';
import { FiCopy, FiCheck } from 'react-icons/fi';

/* ── Copy-to-clipboard button ── */
const CopyButton = ({ text, label = 'Copy headers' }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — silently no-op */
    }
  };
  return (
    <button
      onClick={handleCopy}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 8,
        border: `1.5px solid ${copied ? '#16A34A' : 'rgba(180,43,106,0.3)'}`,
        background: copied ? '#DCFCE7' : '#FDF2F7',
        color: copied ? '#16A34A' : '#B42B6A',
        fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {copied ? <FiCheck size={13} /> : <FiCopy size={13} />}
      {copied ? 'Copied' : label}
    </button>
  );
};

/* ── Blank template grid — a real, empty Excel-shaped table: one header
   row with the exact column names to use, and empty ruled rows below
   showing where data goes. No sample data, no placeholder names. ── */
const TemplateGrid = ({ columns }) => (
  <div style={{ overflowX: 'auto', border: '2px solid #1B1B1A', borderRadius: 2 }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: columns.length * 130 }}>
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th key={i} style={{
              textAlign: 'left', padding: '9px 12px', fontSize: 12.5, fontWeight: 800,
              color: '#1B1B1A', background: '#F2F0EC',
              borderRight: i < columns.length - 1 ? '2px solid #1B1B1A' : 'none',
              borderBottom: '2px solid #1B1B1A', whiteSpace: 'nowrap',
            }}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[0, 1, 2].map(r => (
          <tr key={r}>
            {columns.map((_, i) => (
              <td key={i} style={{
                padding: '14px 12px', height: 20,
                borderRight: i < columns.length - 1 ? '1px solid #D8D3C9' : 'none',
                borderBottom: r < 2 ? '1px solid #D8D3C9' : 'none',
              }}>
                &nbsp;
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* ── Note box — short, standalone bullet points. Not prose. ── */
const Note = ({ points }) => (
  <div style={{
    background: '#FDF2F7', border: '1px solid rgba(180,43,106,0.18)', borderRadius: 10,
    padding: '14px 16px', marginTop: 14,
  }}>
    <div style={{ fontSize: 11, fontWeight: 800, color: '#B42B6A', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
      Note
    </div>
    <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {points.map((p, i) => (
        <li key={i} style={{ fontSize: 13.5, color: '#1B0A12', lineHeight: 1.5 }}>{p}</li>
      ))}
    </ul>
  </div>
);

/* ── AI Prompt block — a literal, copy-pasteable instruction the user can
   hand to an AI assistant (together with the raw master timetable) to get
   back a clean CSE-only XLSX matching the format above. Shown verbatim,
   preformatted, own copy button. ── */
const CSE_TIMETABLE_AI_PROMPT = `# CSE YEAR Examination Timetable – XLSX

Create an **XLSX (Excel) file containing only the CSE YEAR examination schedule** from the provided timetable.

### Required Output Format

The Excel sheet must contain **exactly one row for each CSE exam date/session**.

Use these columns:

| Date       | Time                | Subject | Department |
| ---------- | ------------------- | ------- | ---------- |
| 24-08-2026 | 02:00 PM - 04:00 PM | CD      | CSE        |
| 25-08-2026 | 02:00 PM - 04:00 PM | OOAD    | CSE        |

### Rules

1. Include **ONLY CSE YEAR** examination entries.
2. Do **not** include Civil, Mechanical, ECE, EEE, IT, BME, AI & DS, CSBS, CYs, AIML, VLSI, or any other branch.
3. The \`Department\` column must contain **CSE** for every included row.
4. Extract the **actual date, examination time, and subject exactly as shown in the provided timetable**.
5. Keep subject names exactly as printed in the timetable, including abbreviations, \`/\`, \`&\`, hyphens, or other characters.
6. Create **one row per exam date/session**. Do not create separate rows for individual students or subjects.
7. Use the date format **DD-MM-YYYY**.
8. Keep the examination time exactly as the timetable shows, including AM/PM.
9. Do not invent, rename, expand, or modify subject names.
10. Do not include any explanatory text, notes, or other branches in the Excel data.
11. The final output must be **XLSX format only**.
12. Name the Excel file:
    **CSE_YEAR_Exam_Timetable.xlsx**

### Important

The source timetable may contain multiple years/semesters and multiple departments. **Identify the CSE column belonging to CSE YEAR and extract only those entries.**

The final Excel file should be clean, structured, and immediately usable for automated timetable processing.`;

const AiPromptBlock = () => (
  <div style={{ marginTop: 20, border: '1.5px solid rgba(180,43,106,0.25)', borderRadius: 12, overflow: 'hidden' }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '10px 14px', background: 'linear-gradient(135deg,#FDF2F7,#FEF7FB)',
      borderBottom: '1px solid rgba(180,43,106,0.18)',
    }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1B0A12' }}>Timetable Prompt</div>
        <div style={{ fontSize: 11.5, color: '#9B8F94', marginTop: 1 }}>Paste this into an AI tool along with your raw master timetable to get a clean CSE-only Excel back.</div>
      </div>
      <div style={{ flexShrink: 0 }}>
        <CopyButton text={CSE_TIMETABLE_AI_PROMPT} label="Copy prompt" />
      </div>
    </div>
    <pre style={{
      margin: 0, padding: '14px 16px', maxHeight: 260, overflow: 'auto',
      fontFamily: '"Courier New", monospace', fontSize: 11.5, lineHeight: 1.6,
      color: '#4B4046', background: 'white', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    }}>
      {CSE_TIMETABLE_AI_PROMPT}
    </pre>
  </div>
);

const SectionHead = ({ title, subtitle, copyText }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
    <div>
      <h2 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 800, fontSize: 19, color: '#1B0A12', margin: '0 0 4px' }}>
        {title}
      </h2>
      <p style={{ color: '#6B5E63', fontSize: 13.5, margin: 0, lineHeight: 1.6 }}>{subtitle}</p>
    </div>
    <div style={{ flexShrink: 0, marginTop: 2 }}>
      <CopyButton text={copyText} />
    </div>
  </div>
);

const ExcelFormatGuide = () => {
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '16px 24px 28px' }}>
      <h1 style={{
        fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 900,
        fontSize: 'clamp(24px,4vw,30px)', color: '#000', margin: '0 0 6px',
      }}>
        Excel Format Reference
      </h1>
      <p style={{ color: '#9B8F94', fontSize: 13.5, margin: '0 0 32px' }}>
        Internal reference — the exact column layout the system reads for each upload. Not linked from any menu.
      </p>

      {/* ── Elective Roster ── */}
      <section style={{ marginBottom: 48 }}>
        <SectionHead
          title="1. Elective Roster (Hall Plan → Excel Upload)"
          subtitle="One sheet, one upload — feeds Hall Plan creation, seat/bench assignment, the seating chart, and the Attendance Sheet."
          copyText={'Roll No\tRegister Number\tName\tSection\tAD/IP/BDA'}
        />
        <TemplateGrid columns={['Roll No', 'Register Number', 'Name', 'Section', 'AD/IP/BDA']} />
        <Note points={[
          'Roll No — optional. Only decides order. Never printed.',
          'Register Number — always printed exactly as typed. Never decides order.',
          'Name — always printed exactly as typed.',
          'Section — groups students (A, B, C...).',
          'Last column — rename it to your real subject(s). No fixed subject list.',
          'One subject alone (e.g. IOT) = one group. No separator needed.',
          'Multiple subjects in one column — separate with / , | ; & or +',
          '"-" is never a separator — "UI-UX" stays one subject.',
          'Add more subject columns freely — no limit.',
        ]} />
      </section>

      {/* ── Subject-wise Timetable ── */}
      <section>
        <SectionHead
          title="2. Subject-wise Timetable (Attendance page → Upload Timetable)"
          subtitle="Separate upload — feeds only the Subject-wise Timetable block printed at the bottom of the Attendance Sheet."
          copyText={'Date\tTime\tSubject'}
        />
        <TemplateGrid columns={['Date', 'Time', 'Subject']} />
        <Note points={[
          'Date — any normal format works (24-08-2026, 24/08/2026, 18-Oct...).',
          'Time — free text, printed exactly as typed.',
          'Subject — analyzed and printed exactly as typed. No fixed subject list.',
          'Multiple departments in one sheet? Add a Department column — only CSE rows are kept, rest skipped.',
          'No Department column — every row is assumed CSE automatically.',
        ]} />
        <AiPromptBlock />
      </section>
    </div>
  );
};

export default ExcelFormatGuide;
