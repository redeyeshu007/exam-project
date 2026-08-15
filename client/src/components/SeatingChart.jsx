import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { FiDownload, FiArrowLeft, FiGrid, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

const PRINT_FONT = '"Times New Roman", Times, serif';

const YEAR_COLORS = {
  I:   { bg: '#EFF6FF', border: '#93C5FD', badge: '#DBEAFE', badgeText: '#1E40AF', accent: '#1D4ED8', fill: '#DBEAFE' },
  II:  { bg: '#F0FDF4', border: '#86EFAC', badge: '#DCFCE7', badgeText: '#166534', accent: '#16A34A', fill: '#DCFCE7' },
  III: { bg: '#FFFBEB', border: '#FDE68A', badge: '#FEF3C7', badgeText: '#78350F', accent: '#B45309', fill: '#FEF3C7' },
  IV:  { bg: '#FDF4FF', border: '#E9D5FF', badge: '#F3E8FF', badgeText: '#6B21A8', accent: '#7C3AED', fill: '#F3E8FF' },
};

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`;
}

function buildSeatMap(layoutBenches, seats) {
  if (!layoutBenches || layoutBenches.length === 0) return null;
  // Must walk benches in the exact same order the server filled them
  // (server/utils/seatAllocator.js sorts by label — the order benches were
  // placed in Hall Designer) since seats are matched back here purely by
  // positional seatNumber, not benchId.
  const sorted = [...layoutBenches].sort((a, b) => {
    const la = parseInt(a.label, 10);
    const lb = parseInt(b.label, 10);
    if (!isNaN(la) && !isNaN(lb)) return la - lb;
    return 0;
  });

  // Group seats by benchId
  const seatsByBench = {};
  (seats || []).forEach(s => {
    if (s.benchId) {
      if (!seatsByBench[s.benchId]) seatsByBench[s.benchId] = [];
      seatsByBench[s.benchId].push(s);
    }
  });

  const byNumber = {};
  (seats || []).forEach(s => { byNumber[s.seatNumber] = s; });
  const cellMap = {};
  let idx = 1;
  sorted.forEach(bench => {
    const numSeats = seatsByBench[bench.id]?.length || 0;
    const slots = Math.max(bench.type === 'BB' ? 2 : 1, numSeats);
    const entry = { bench, slots: [] };
    for (let i = 0; i < slots; i++) {
      entry.slots.push(byNumber[idx] || null);
      idx++;
    }
    cellMap[`${bench.row}_${bench.col}`] = entry;
  });
  return cellMap;
}

function getYearBreakdown(seats) {
  const bd = {};
  (seats || []).forEach(s => { const y = s.year || '?'; bd[y] = (bd[y] || 0) + 1; });
  return bd;
}

/* ─────────────────────────────────────────
   Common SVG Defs for Seating Charts
   ───────────────────────────────────────── */
const SVGDefs = () => (
  <svg style={{ position: 'absolute', width: 0, height: 0 }}>
    <defs>
      <linearGradient id="seatDeskWood" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E5A65D" />
        <stop offset="100%" stopColor="#C6863F" />
      </linearGradient>
      <linearGradient id="seatChairWood" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#B07530" />
        <stop offset="100%" stopColor="#8A561D" />
      </linearGradient>
      <filter id="deskShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.12" />
      </filter>
    </defs>
  </svg>
);

/* ── Screen bench components (Professional RedBus style) ── */
const ScreenCell = ({ cellData, size }) => {
  const { bench, slots } = cellData;
  const isBB = bench.type === 'BB' || slots.length > 1;
  
  // Render a Single Bench (SB) representation
  if (!isBB) {
    const seat = slots[0];
    const isAllocated = seat !== null;
    const yc = isAllocated ? (YEAR_COLORS[seat.year] || YEAR_COLORS['I']) : null;
    const cellHeight = Math.round(size * 0.72);

    return (
      <div style={{
        width: size,
        height: cellHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        border: '2px solid #1A1A1A',
        borderRadius: '8px',
        background: isAllocated ? '#FFFFFF' : '#FAFAFA',
        boxShadow: isAllocated ? '0 3px 8px rgba(0,0,0,0.06)' : 'none'
      }}>
        {/* Top view representation */}
        <svg width="100%" height="100%" viewBox="0 0 68 72" style={{ maxWidth: '100%', padding: '2px' }}>
          {/* Desk representation */}
          <rect x="8" y="6" width="52" height="20" rx="3" fill={isAllocated ? 'url(#seatDeskWood)' : 'none'} stroke={isAllocated ? '#A06428' : '#94A3B8'} strokeWidth="1" strokeDasharray={isAllocated ? '0' : '2 2'} />
          
          {/* Chair representation */}
          {isAllocated ? (
            <rect x="22" y="32" width="24" height="14" rx="4" fill={yc.fill} stroke={yc.accent} strokeWidth="1.5" />
          ) : (
            <rect x="22" y="32" width="24" height="14" rx="4" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="2 2" />
          )}

          {/* Student/Allocation Text Info Overlay */}
          {isAllocated ? (
            <g>
              {/* Year Section Badge */}
              <rect x="20" y="10" width="28" height="8" rx="2" fill="#FFFFFF" stroke="#1A1A1A" strokeWidth="0.8" />
              <text x="34" y="16" textAnchor="middle" fontSize="6px" fontWeight="900" fill="#1A1A1A">
                {seat.year} {seat.section}
              </text>
              {/* Register No / SNO */}
              <text x="34" y="41" textAnchor="middle" fontSize="8px" fontWeight="900" fill={yc.badgeText} fontFamily="'JetBrains Mono', monospace">
                {seat.sno}
              </text>
            </g>
          ) : (
            <text x="34" y="19" textAnchor="middle" fontSize="7px" fontWeight="700" fill="#94A3B8">
              EMPTY
            </text>
          )}
        </svg>
      </div>
    );
  }

  // Render a Big Bench with a 3rd (middle) occupant — lab overflow case
  // only (seatIndex 2 from seatAllocator.js's Pass 4). Rendered as a
  // distinct simple 3-column card rather than retrofitting the fixed
  // two-chair SVG art above, so the normal 1-seat and 2-seat renderings
  // stay completely unchanged.
  if (slots.length === 3) {
    const cellHeight3 = Math.round(size * 0.72);
    return (
      <div style={{
        width: size,
        height: cellHeight3,
        display: 'flex',
        border: '2px solid #1A1A1A',
        borderRadius: '8px',
        background: '#FFFFFF',
        boxShadow: '0 3px 8px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        {slots.map((seat, i) => {
          const yc = seat ? (YEAR_COLORS[seat.year] || YEAR_COLORS['I']) : null;
          return (
            <div key={i} style={{
              flex: 1, minWidth: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 2, padding: '2px',
              borderRight: i < 2 ? '1.5px solid #1A1A1A' : 'none',
              background: seat ? yc.bg : '#FAFAFA',
            }}>
              {seat ? (
                <>
                  <span style={{ fontSize: Math.max(7, size * 0.07), fontWeight: 900, color: '#1A1A1A', lineHeight: 1 }}>
                    {seat.year} {seat.section}
                  </span>
                  <span style={{ fontSize: Math.max(8, size * 0.09), fontWeight: 900, color: yc.badgeText, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
                    {seat.sno}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: Math.max(6, size * 0.06), fontWeight: 700, color: '#94A3B8' }}>EMPTY</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Render a Double Bench (BB) representation
  const s1 = slots[0];
  const s2 = slots[1];
  const isLeftAllocated = s1 !== null;
  const isRightAllocated = s2 !== null;
  const anyAllocated = isLeftAllocated || isRightAllocated;

  const yc1 = isLeftAllocated ? (YEAR_COLORS[s1.year] || YEAR_COLORS['I']) : null;
  const yc2 = isRightAllocated ? (YEAR_COLORS[s2.year] || YEAR_COLORS['I']) : null;
  const cellHeightBB = Math.round(size * 0.72);

  return (
    <div style={{
      width: size,
      height: cellHeightBB,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      border: '2px solid #1A1A1A',
      borderRadius: '8px',
      background: anyAllocated ? '#FFFFFF' : '#FAFAFA',
      boxShadow: anyAllocated ? '0 3px 8px rgba(0,0,0,0.06)' : 'none'
    }}>
      <svg width="100%" height="100%" viewBox="0 0 112 72" style={{ maxWidth: '100%', padding: '2px' }}>
        {/* Double Desk surface */}
        <rect x="8" y="6" width="96" height="20" rx="3" fill={anyAllocated ? 'url(#seatDeskWood)' : 'none'} stroke={anyAllocated ? '#A06428' : '#94A3B8'} strokeWidth="1" strokeDasharray={anyAllocated ? '0' : '2 2'} />
        
        {/* Left Chair */}
        {isLeftAllocated ? (
          <rect x="16" y="32" width="24" height="14" rx="4" fill={yc1.fill} stroke={yc1.accent} strokeWidth="1.5" />
        ) : (
          <rect x="16" y="32" width="24" height="14" rx="4" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="2 2" />
        )}

        {/* Right Chair */}
        {isRightAllocated ? (
          <rect x="72" y="32" width="24" height="14" rx="4" fill={yc2.fill} stroke={yc2.accent} strokeWidth="1.5" />
        ) : (
          <rect x="72" y="32" width="24" height="14" rx="4" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="2 2" />
        )}

        {/* Left Seat text */}
        {isLeftAllocated ? (
          <g>
            <rect x="14" y="10" width="28" height="8" rx="2" fill="#FFFFFF" stroke="#1A1A1A" strokeWidth="0.8" />
            <text x="28" y="16" textAnchor="middle" fontSize="6px" fontWeight="900" fill="#1A1A1A">
              {s1.year} {s1.section}
            </text>
            <text x="28" y="41" textAnchor="middle" fontSize="8px" fontWeight="900" fill={yc1.badgeText} fontFamily="'JetBrains Mono', monospace">
              {s1.sno}
            </text>
          </g>
        ) : (
          <text x="28" y="18" textAnchor="middle" fontSize="6px" fontWeight="700" fill="#94A3B8">
            EMPTY
          </text>
        )}

        {/* Right Seat text */}
        {isRightAllocated ? (
          <g>
            <rect x="70" y="10" width="28" height="8" rx="2" fill="#FFFFFF" stroke="#1A1A1A" strokeWidth="0.8" />
            <text x="84" y="16" textAnchor="middle" fontSize="6px" fontWeight="900" fill="#1A1A1A">
              {s2.year} {s2.section}
            </text>
            <text x="84" y="41" textAnchor="middle" fontSize="8px" fontWeight="900" fill={yc2.badgeText} fontFamily="'JetBrains Mono', monospace">
              {s2.sno}
            </text>
          </g>
        ) : (
          <text x="84" y="18" textAnchor="middle" fontSize="6px" fontWeight="700" fill="#94A3B8">
            EMPTY
          </text>
        )}
      </svg>
    </div>
  );
};

const ScreenGrid = ({ hallChart, layout, size }) => {
  if (!layout) {
    return (
      <div style={{ padding: 14, background: '#FFFBEB', borderRadius: 10, border: '1.5px solid #FCD34D', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#92400E', fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
          <FiAlertCircle size={13} /> No layout — showing seat list
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(hallChart.seats || []).map(s => {
            const yc = YEAR_COLORS[s.year] || YEAR_COLORS['I'];
            return (
              <div key={s.seatNumber} style={{
                padding: '6px 10px', borderRadius: 8, background: yc.bg,
                border: `1px solid ${yc.border}`, minWidth: 70, textAlign: 'center',
                animation: 'cardSlideUp 0.25s ease both',
              }}>
                <div style={{ fontSize: 9, color: '#9B8F94', fontWeight: 700 }}>#{s.seatNumber}</div>
                <div style={{ fontWeight: 800, fontSize: 11, color: yc.accent }}>{s.year} {s.section}</div>
                <div style={{ fontSize: 10, fontWeight: 700 }}>{s.sno}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const cellMap = buildSeatMap(layout.benches, hallChart.seats);
  if (!cellMap) return null;

  // Filter columns to keep only those with at least one assigned seat
  const activeCols = [];
  for (let c = 0; c < layout.cols; c++) {
    let hasSeat = false;
    for (let r = 0; r < layout.rows; r++) {
      const cd = cellMap[`${r}_${c}`];
      if (cd && cd.slots.some(s => s !== null)) {
        hasSeat = true;
        break;
      }
    }
    if (hasSeat) {
      activeCols.push(c);
    }
  }
  const colsToRender = activeCols.length > 0 ? activeCols : Array.from({ length: layout.cols }, (_, i) => i);

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${colsToRender.length}, ${size}px)`,
        gap: 14, width: 'fit-content', padding: 4, margin: '0 auto',
      }}>
        {Array.from({ length: layout.rows }, (_, r) =>
          colsToRender.map(c => {
            const k = `${r}_${c}`;
            const cd = cellMap[k];
            if (cd) return <ScreenCell key={k} cellData={cd} size={size} />;
            const uniformHeight = Math.round(size * 0.72);
            return <div key={k} style={{ width: size, minHeight: uniformHeight }} />;
          })
        )}
      </div>
      {/* Column Headers at Bottom: A, B, C... */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${colsToRender.length}, ${size}px)`,
        gap: 14, width: 'fit-content', padding: '0 4px', margin: '8px auto 0'
      }}>
        {colsToRender.map(c => (
          <div key={c} style={{
            textAlign: 'center', fontWeight: '800', fontSize: '14px', color: '#B42B6A',
            padding: '6px 0', borderTop: '2.5px solid #B42B6A', letterSpacing: '0.5px'
          }}>
            {String.fromCharCode(65 + c)}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Print bench components — B&W ── */
const PrintCell = ({ cellData }) => {
  const { slots } = cellData;
  const assigned = slots.filter(s => s !== null);

  if (assigned.length === 0) {
    return <div style={{ width: '100%', minHeight: 34 }} />;
  }

  // Common wrapper styling for the print card — each bench renders as
  // its own clearly bordered block, evenly spaced from its neighbors
  // via the grid gap (not touching), with consistent internal padding.
  const cardStyle = {
    width: '100%',
    minHeight: 34,
    display: 'flex',
    boxSizing: 'border-box',
    border: '1.3px solid #000',
    fontFamily: PRINT_FONT,
  };

  if (assigned.length === 1) {
    const seat = assigned[0];
    return (
      <div style={cardStyle}>
        <div style={{
          flex: 1, padding: '5px 6px', height: '100%', boxSizing: 'border-box',
          textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: '7.5pt', fontWeight: 'normal', color: '#333' }}>
              {seat.year} {seat.section}
            </div>
            <div style={{ fontSize: '10.5pt', fontWeight: 'bold', marginTop: '2px', color: '#000' }}>
              {seat.sno || '—'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // assigned.length === 3 — lab overflow case (middle seat). Same visual
  // language as the 2-column layout below, just split into three equal
  // columns with two dividers instead of one, so it prints exactly as
  // one bench cleanly separated into 3.
  if (assigned.length === 3) {
    return (
      <div style={cardStyle}>
        {assigned.map((seat, i) => (
          <div key={i} style={{
            flex: 1, padding: '5px 4px', height: '100%', boxSizing: 'border-box',
            textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRight: i < 2 ? '1.3px solid #000' : 'none',
          }}>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: '7pt', fontWeight: 'normal', color: '#333' }}>
                {seat.year} {seat.section}
              </div>
              <div style={{ fontSize: '9.5pt', fontWeight: 'bold', marginTop: '2px', color: '#000' }}>
                {seat.sno || '—'}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // assigned.length === 2
  const s1 = assigned[0];
  const s2 = assigned[1];

  return (
    <div style={cardStyle}>
      {/* Left Slot */}
      <div style={{
        flex: 1, padding: '5px 6px', height: '100%', boxSizing: 'border-box',
        textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRight: '1.3px solid #000',
      }}>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: '7.5pt', fontWeight: 'normal', color: '#333' }}>
            {s1.year} {s1.section}
          </div>
          <div style={{ fontSize: '10.5pt', fontWeight: 'bold', marginTop: '2px', color: '#000' }}>
            {s1.sno || '—'}
          </div>
        </div>
      </div>
      {/* Right Slot */}
      <div style={{
        flex: 1, padding: '5px 6px', height: '100%', boxSizing: 'border-box',
        textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: '7.5pt', fontWeight: 'normal', color: '#333' }}>
            {s2.year} {s2.section}
          </div>
          <div style={{ fontSize: '10.5pt', fontWeight: 'bold', marginTop: '2px', color: '#000' }}>
            {s2.sno || '—'}
          </div>
        </div>
      </div>
    </div>
  );
};

const PrintGrid = ({ hallChart, layout }) => {
  if (!layout) {
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}>
        <thead>
          <tr>
            {['Seat#', 'Year / Sec / Roll No.'].map(h => (
              <th key={h} style={{ border: '1px solid #000', padding: '4px 6px', fontFamily: PRINT_FONT, fontSize: '9pt', background: '#f0f0f0' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(hallChart.seats || []).map(s => (
            <tr key={s.seatNumber}>
              <td style={{ border: '1px solid #000', padding: '3px 6px', fontFamily: PRINT_FONT, fontSize: '8.5pt', textAlign: 'center' }}>#{s.seatNumber}</td>
              <td style={{ border: '1px solid #000', padding: '3px 6px', fontFamily: PRINT_FONT, fontSize: '8.5pt', fontWeight: 'bold' }}>
                {s.year} {s.section} — {s.sno}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  const cellMap = buildSeatMap(layout.benches, hallChart.seats);
  if (!cellMap) return null;

  // Filter columns to keep only those with at least one assigned seat
  const activeCols = [];
  for (let c = 0; c < layout.cols; c++) {
    let hasSeat = false;
    for (let r = 0; r < layout.rows; r++) {
      const cd = cellMap[`${r}_${c}`];
      if (cd && cd.slots.some(s => s !== null)) {
        hasSeat = true;
        break;
      }
    }
    if (hasSeat) {
      activeCols.push(c);
    }
  }
  const colsToRender = activeCols.length > 0 ? activeCols : Array.from({ length: layout.cols }, (_, i) => i);

  // Bottom-up presentation for print only: the row farthest from the
  // blackboard (highest row index in the Hall Designer) is rendered
  // first (top of the PDF), and row 0 (nearest the blackboard) last
  // (bottom of the PDF) — a pure rendering-order flip. Bench positions,
  // seat numbers, and student assignments are untouched; only the
  // vertical order they're printed in changes.
  const printRowOrder = Array.from({ length: layout.rows }, (_, i) => layout.rows - 1 - i);

  return (
    <div>
      {/* Grid gap widened so each bench reads as its own separated
         block rather than a crowded, edge-to-edge mass. */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colsToRender.length}, 1fr)`, gap: 6 }}>
        {printRowOrder.map(r =>
          colsToRender.map(c => {
            const k = `${r}_${c}`;
            const cd = cellMap[k];
            if (cd) return <PrintCell key={k} cellData={cd} />;
            return <div key={k} style={{ minHeight: 34 }} />;
          })
        )}
      </div>
      {/* Column Headers for Print at Bottom */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colsToRender.length}, 1fr)`, gap: 6, marginTop: 10 }}>
        {colsToRender.map(c => (
          <div key={c} style={{
            textAlign: 'center', fontWeight: 'bold', fontSize: '16pt', fontFamily: PRINT_FONT,
            borderTop: '2px solid #000', paddingTop: 4
          }}>
            {String.fromCharCode(65 + c)}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Main ── */
const SeatingChart = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const printRef = useRef(null);

  const [allocation, setAllocation] = useState(null);
  const [layouts, setLayouts] = useState({});
  const [activeHall, setActiveHall] = useState('');
  const [loading, setLoading] = useState(true);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Seating Chart — ${allocation?.examName || 'Exam'}`,
  });

  useEffect(() => {
    api.get(`/allocations/${id}`)
      .then(async res => {
        const alloc = res.data;
        setAllocation(alloc);
        const hallNames = (alloc.seatingChart || []).map(h => h.hallName);
        if (hallNames.length > 0) setActiveHall(hallNames[0]);
        const lmap = {};
        await Promise.all(hallNames.map(async hn => {
          try { const r = await api.get(`/hall-layouts/${encodeURIComponent(hn)}`); lmap[hn] = r.data; }
          catch { /* no layout for this hall */ }
        }));
        setLayouts(lmap);
      })
      .catch(() => toast.error('Failed to load seating chart'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div className="spinner-border" style={{ color: '#B42B6A', width: 36, height: 36 }} role="status" />
      <div style={{ fontSize: 13, color: '#9B8F94', fontWeight: 600 }}>Loading seating chart…</div>
    </div>
  );

  if (!allocation) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#9B8F94' }}>
      <FiGrid size={40} color="#D1D5DB" />
      <div style={{ fontWeight: 700 }}>Allocation not found</div>
      <button onClick={() => navigate(-1)} style={{ padding: '8px 20px', borderRadius: 50, border: '1.5px solid #E8E2E5', background: 'white', cursor: 'pointer', fontWeight: 700 }}>Go Back</button>
    </div>
  );

  const hallCharts  = allocation.seatingChart || [];
  const activeChart = hallCharts.find(h => h.hallName === activeHall);
  const activeLayout = layouts[activeHall] || null;
  const cols    = activeLayout?.cols || 5;
  const YEAR_LABELS = { I: 'I Year', II: 'II Year', III: 'III Year', IV: 'IV Year' };

  // Calculate cell size to fit the grid in the available width — reactive
  // to window resizes (via windowWidth state) rather than a one-shot read.
  const isMobileView = windowWidth < 600;
  const isTabletView = windowWidth >= 600 && windowWidth < 992;
  const availW  = Math.min(windowWidth - 24, isMobileView ? windowWidth - 24 : 1200);
  const cellSize = isMobileView
    ? Math.max(70, Math.floor(availW / Math.min(cols, 4)))
    : isTabletView
      ? Math.min(108, Math.max(78, Math.floor(availW / cols)))
      : Math.min(130, Math.max(84, Math.floor(availW / cols)));

  const yearBd = activeChart ? getYearBreakdown(activeChart.seats) : {};
  const years  = Object.keys(yearBd).sort();

  const chunks = [];
  for (let i = 0; i < hallCharts.length; i += 2) {
    chunks.push(hallCharts.slice(i, i + 2));
  }

  const renderPrintHall = (hc) => {
    const layout = layouts[hc.hallName] || null;
    const hYears = Object.keys(getYearBreakdown(hc.seats || [])).sort();
    const totalStudents = hc.totalStudents ?? hc.filled;

    // Scale-to-fit: each half-page is a fixed 132mm tall. A grid whose
    // rows (34px cell + 6px gap each, plus a ~10mm column-label row)
    // would exceed the space left after the header is scaled down via
    // zoom (which reserves the scaled space, unlike transform) so it
    // never gets silently clipped by the half-page's overflow:hidden.
    const availableGridPx = (hYears.length > 1 ? 78 : 84) * 3.7795; // mm → px
    const neededGridPx = layout ? layout.rows * 40 : 0;
    const printScale = neededGridPx > availableGridPx
      ? Math.max(0.5, availableGridPx / neededGridPx)
      : 1;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', borderBottom: '1.5px solid #000', paddingBottom: 4, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '2px' }}>
            <img src="/psna2logo.png" alt="PSNA" style={{ height: '32px' }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '11pt', lineHeight: 1.1 }}>
                PSNA COLLEGE OF ENGINEERING AND TECHNOLOGY, DINDIGUL
              </div>
              <div style={{ fontFamily: PRINT_FONT, fontSize: '8pt', fontStyle: 'italic', color: '#444' }}>
                (An Autonomous Institution affiliated to Anna University)
              </div>
            </div>
          </div>
          <div style={{ fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '9pt', marginTop: 1 }}>
            DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING
          </div>
          <div style={{ fontFamily: PRINT_FONT, fontWeight: 'bold', fontSize: '10pt', marginTop: 2, letterSpacing: '0.5px' }}>
            SEATING ARRANGEMENT
          </div>
        </div>

        {/* Hall info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: PRINT_FONT, fontSize: '8.5pt', fontWeight: 'bold', marginBottom: 4, paddingBottom: 2, borderBottom: '1px solid #000', flexWrap: 'wrap', gap: 2 }}>
          <span>Hall: {hc.hallName}</span>
          <span>{allocation.examName}</span>
          <span>{hYears.map(y => ({ I: 'I Year', II: 'II Year', III: 'III Year', IV: 'IV Year' }[y] || y)).join(' & ')}</span>
          <span>Date: {formatDate(allocation.fromDate)}{allocation.toDate && allocation.toDate !== allocation.fromDate ? ` to ${formatDate(allocation.toDate)}` : ''}</span>
          <span>Session: {allocation.session}</span>
          <span>Students: {totalStudents}</span>
        </div>

        {/* Year breakdown (only when mixed) */}
        {hYears.length > 1 && (
          <div style={{ display: 'flex', gap: 12, fontFamily: PRINT_FONT, fontSize: '7.5pt', marginBottom: 4, flexWrap: 'wrap' }}>
            {hYears.map(y => (
              <span key={y}><strong>{({ I: 'I Year', II: 'II Year', III: 'III Year', IV: 'IV Year' }[y] || y)}:</strong> {getYearBreakdown(hc.seats)[y]} students</span>
            ))}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, zoom: printScale }}>
          <PrintGrid hallChart={hc} layout={layout} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F8F5F7' }}>
      <SVGDefs />
      <style>{`
        /* Tablet: force the summary cards into a clean 2-per-row wrap
           instead of an uneven flex-wrap balance. Desktop and mobile
           are untouched (mobile already stacks via its own narrow
           viewport; desktop fits all cards on one row). */
        @media (min-width: 600px) and (max-width: 991px) {
          .seating-stats-strip { gap: 10px !important; }
          .seating-stat-card { flex: 1 1 calc(50% - 10px) !important; }
        }
      `}</style>

      {/* ── Sticky top bar (no-print) ── */}
      <div className="no-print" style={{
        flexShrink: 0, background: 'white',
        borderBottom: '1px solid #E8E2E5',
        padding: '9px 24px',
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 50,
              border: '1.5px solid #E8E2E5', background: 'white',
              cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#6B5E63',
              transition: 'all 0.15s',
            }}
          >
            <FiArrowLeft size={13} /> Back
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 800, fontSize: 'clamp(14px,2.5vw,18px)', color: '#1B0A12', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {allocation.examName} — {YEAR_LABELS[allocation.year] || allocation.year}
            </div>
            <div style={{ fontSize: 11, color: '#9B8F94', marginTop: 1 }}>
              {formatDate(allocation.fromDate)}{allocation.toDate && allocation.toDate !== allocation.fromDate ? ` to ${formatDate(allocation.toDate)}` : ''} &bull; {allocation.session}
            </div>
          </div>

          {!isMobileView && (
            <button
              onClick={handlePrint}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 20px', borderRadius: 50, border: 'none',
                background: 'linear-gradient(135deg,#B42B6A,#9A2259)',
                color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(180,43,106,0.3)',
                whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              <FiDownload size={13} /> Print / PDF
            </button>
          )}
        </div>

        {/* Hall tabs */}
        {hallCharts.length > 1 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {hallCharts.map(hc => (
              <button
                key={hc.hallName}
                onClick={() => setActiveHall(hc.hallName)}
                className={`pill-tab${activeHall === hc.hallName ? ' active' : ''}`}
              >
                {hc.hallName} <span style={{ opacity: 0.65, fontWeight: 600 }}>({hc.totalStudents ?? hc.filled})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Scrollable content (no-print). Horizontal overflow is contained
           to the seating grid itself (ScreenGrid has its own overflowX
           scroller) — the rest of the page (stats/legend) should reflow
           via flex-wrap instead of triggering a page-wide horizontal
           scrollbar. ── */}
      <div className="no-print" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: isMobileView ? '10px 10px 84px' : '12px 12px' }}>
        {!activeChart ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9B8F94' }}>
            <FiGrid size={36} color="#D1D5DB" style={{ marginBottom: 10 }} />
            <div style={{ fontWeight: 700, marginBottom: 4 }}>No seating chart generated</div>
            <div style={{ fontSize: 13 }}>Go to <strong>Seating Allotment</strong> to generate bench-level seating.</div>
          </div>
        ) : (
          <div className="page-enter">
            {/* Stats strip */}
            <div className="seating-stats-strip" style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'stretch' }}>
              {[
                { l: 'Hall',     v: activeHall },
                { l: 'Students', v: activeChart.totalStudents ?? activeChart.filled },
                { l: 'Capacity', v: activeChart.capacity || '—' },
                { l: 'Session',  v: allocation.session },
              ].map(({ l, v }, i) => (
                <div key={l} className={`card-enter card-enter-d${i + 1} seating-stat-card`} style={{
                  padding: '6px 11px', background: 'rgba(255,255,255,0.55)',
                  backdropFilter: 'blur(14px) saturate(1.4)', WebkitBackdropFilter: 'blur(14px) saturate(1.4)',
                  borderRadius: 12,
                  border: '1px solid rgba(232,226,229,0.8)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#9B8F94', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 1 }}>{l}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: '#1B0A12' }}>{v}</div>
                </div>
              ))}
              {years.length > 0 && (
                <div className="card-enter card-enter-d5 seating-stat-card" style={{
                  padding: '6px 11px', background: 'rgba(255,255,255,0.55)',
                  backdropFilter: 'blur(14px) saturate(1.4)', WebkitBackdropFilter: 'blur(14px) saturate(1.4)',
                  borderRadius: 12, border: '1px solid rgba(232,226,229,0.8)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: '#9B8F94', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Year Mix</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {years.map(y => {
                      const yc = YEAR_COLORS[y] || YEAR_COLORS['I'];
                      return <span key={y} style={{ fontSize: 10.5, fontWeight: 800, background: yc.badge, color: yc.badgeText, padding: '2px 7px', borderRadius: 6 }}>{y}: {yearBd[y]}</span>;
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: '#6B5E63', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                <div style={{ width: 22, height: 14, borderRadius: '4px 4px 2px 2px', background: '#FFFFFF', border: '1.5px solid #1A1A1A' }} />
                Empty Seating Slot
              </div>
              <div style={{ fontSize: 11, color: '#6B5E63', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                <div style={{ width: 22, height: 14, borderRadius: '4px 4px 2px 2px', background: '#DBEAFE', border: '1.5px solid #1D4ED8' }} />
                Allocated Seat (Blue: I Year, Green: II, Yellow: III, Purple: IV)
              </div>
              <div style={{ fontSize: 11, color: '#9B8F94', fontStyle: 'italic' }}>
                Each cell shows: Year Section badge · Student Register No
              </div>
            </div>

            <ScreenGrid hallChart={activeChart} layout={activeLayout} size={cellSize} />
          </div>
        )}
      </div>

      {/* ── Mobile-only sticky bottom Print/PDF button ── */}
      {isMobileView && (
        <button
          className="no-print"
          onClick={handlePrint}
          style={{
            position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '13px 20px', borderRadius: 50, border: 'none',
            background: 'linear-gradient(135deg,#B42B6A,#9A2259)',
            color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(180,43,106,0.35)',
          }}
        >
          <FiDownload size={14} /> Print / PDF
        </button>
      )}

      {/* ── Print area (hidden on screen, rendered when printing) ── */}
      <div ref={printRef} className="print-only">
        {chunks.map((chunk, pageIdx) => {
          const hc1 = chunk[0];
          const hc2 = chunk[1];
          return (
            <div key={pageIdx} style={{
              width: '210mm',
              height: '297mm',
              padding: '8mm 12mm',
              boxSizing: 'border-box',
              fontFamily: PRINT_FONT,
              background: 'white',
              pageBreakAfter: pageIdx < chunks.length - 1 ? 'always' : 'auto',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
            }}>
              {/* Top Half */}
              <div style={{ height: '132mm', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', overflow: 'hidden' }}>
                {renderPrintHall(hc1)}
              </div>

              {/* Tear Divider */}
              <div style={{ height: '17mm', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <div style={{ width: '100%', borderTop: '1.5px dashed #000', position: 'relative' }}>
                  <span style={{
                    position: 'absolute',
                    top: -9,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'white',
                    padding: '0 10px',
                    fontFamily: PRINT_FONT,
                    fontSize: '8pt',
                    fontWeight: 'bold',
                    color: '#000',
                    whiteSpace: 'nowrap'
                  }}>
                    ✂ &nbsp; Cut / Tear Here &nbsp; ✂
                  </span>
                </div>
              </div>

              {/* Bottom Half */}
              <div style={{ height: '132mm', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', overflow: 'hidden' }}>
                {hc2 ? renderPrintHall(hc2) : (
                  <div style={{
                    flex: 1,
                    border: '1.5px dashed #ccc',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#888',
                    fontStyle: 'italic',
                    fontSize: '10pt'
                  }}>
                    [ Intentionally Left Blank ]
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <style>{`
          @media print {
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; background: white; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          }
        `}</style>
      </div>
    </div>
  );
};

export default SeatingChart;
