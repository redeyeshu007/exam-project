import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { m } from 'framer-motion';
import {
  FiSave, FiTrash2, FiPlus, FiMinus, FiGrid,
  FiAlertCircle, FiCheckCircle, FiInfo,
  FiRefreshCw, FiX, FiZoomIn, FiZoomOut, FiCopy
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';
import { fadeUp, staggerContainer } from '../motion';

/* ─────────────────────────────────────────
   Constants & helpers
   ───────────────────────────────────────── */
const COLORS = {
  primary: '#B42B6A',
  primaryLight: '#FDF2F7',
  primaryBorder: 'rgba(180,43,106,0.25)',
};

const MODE_INFO = {
  addSB:  { label: 'Add Small Bench (SB)',  color: '#B42B6A', desc: '1 Seat Desk' },
  addBB:  { label: 'Add Big Bench (BB)',    color: '#E5A65D', desc: '2 Seat Desk' },
  delete: { label: 'Delete Bench',     color: '#EF4444', desc: 'Remove Bench' },
  toggle: { label: 'Toggle SB ↔ BB',  color: '#8B5CF6', desc: 'Switch Type' },
};

function computeLabels(benchMap) {
  // Labels follow the order benches were placed (Map insertion order), not
  // row/column position — the first bench you click is #1, the next is #2,
  // wherever it sits. Deleting a bench renumbers the rest sequentially so
  // there's never a gap, without disturbing everyone else's relative order.
  const updated = new Map();
  let idx = 1;
  benchMap.forEach((bench, key) => {
    updated.set(key, { ...bench, label: String(idx++) });
  });
  return updated;
}

function computeTotalSeats(benchMap) {
  let total = 0;
  benchMap.forEach(b => { total += b.type === 'BB' ? 2 : 1; });
  return total;
}

/* ─────────────────────────────────────────
   Common SVG Assets & Gradients
   ───────────────────────────────────────── */
const SVGDefs = () => (
  <svg style={{ position: 'absolute', width: 0, height: 0 }}>
    <defs>
      <linearGradient id="deskWood" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#E5A65D" />
        <stop offset="100%" stopColor="#C6863F" />
      </linearGradient>
      <linearGradient id="chairWood" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#B07530" />
        <stop offset="100%" stopColor="#8A561D" />
      </linearGradient>
      <linearGradient id="teacherDeskWood" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#D49047" />
        <stop offset="100%" stopColor="#B07530" />
      </linearGradient>
      
      <filter id="deskShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.15" />
      </filter>
      <filter id="activeGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#B42B6A" floodOpacity="0.65" />
      </filter>
      <filter id="deleteGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#EF4444" floodOpacity="0.65" />
      </filter>
    </defs>
  </svg>
);

/* ─────────────────────────────────────────
   Bench cell components (Visual Architecture Style)
   ───────────────────────────────────────── */
const SBCell = memo(function SBCell({ label, hovered, mode, row, col, onClick }) {
  const isDeleteMode = mode === 'delete';
  const filterStyle = isDeleteMode
    ? 'url(#deleteGlow)'
    : hovered
      ? 'url(#activeGlow)'
      : 'url(#deskShadow)';

  return (
    <div
      onClick={() => onClick(row, col)}
      className="bench-cell-wrap"
      style={{
        width: '100%',
        height: '76px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
        userSelect: 'none',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: hovered ? 'scale(1.05) translateY(-2px)' : 'none',
        animation: 'benchPlace 0.2s ease-out forwards',
        border: '2px solid #1A1A1A',
        borderRadius: '8px',
        background: '#FFFFFF'
      }}
    >
      <svg width="100%" height="72" viewBox="0 0 68 72" style={{ maxWidth: '84px', filter: filterStyle }}>
        <line x1="14" y1="12" x2="14" y2="34" stroke="#8A561D" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="54" y1="12" x2="54" y2="34" stroke="#8A561D" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="8" y="6" width="52" height="20" rx="3" fill="url(#deskWood)" stroke="#A06428" strokeWidth="1" />
        <rect x="10" y="8" width="48" height="5" fill="#FFE1B3" opacity="0.15" />
        <path d="M22,46 L46,46" stroke="#4B5563" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M20,46 Q34,50 48,46" stroke="#4B5563" strokeWidth="2" fill="none" />
        <rect x="22" y="32" width="24" height="14" rx="4" fill="url(#chairWood)" stroke="#6E3D0D" strokeWidth="0.8" />
        <circle cx="34" cy="16" r="8" fill="#FFFFFF" stroke={isDeleteMode ? '#EF4444' : '#B42B6A'} strokeWidth="1.5" />
        <text x="34" y="19" textAnchor="middle" fontSize="9px" fontWeight="900" fill={isDeleteMode ? '#EF4444' : '#B42B6A'} fontFamily="'JetBrains Mono', monospace">
          {label}
        </text>
      </svg>
    </div>
  );
});

const BBCell = memo(function BBCell({ label, hovered, mode, row, col, onClick }) {
  const isDeleteMode = mode === 'delete';
  const filterStyle = isDeleteMode
    ? 'url(#deleteGlow)'
    : hovered
      ? 'url(#activeGlow)'
      : 'url(#deskShadow)';

  return (
    <div
      onClick={() => onClick(row, col)}
      className="bench-cell-wrap"
      style={{
        width: '100%',
        height: '76px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
        userSelect: 'none',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: hovered ? 'scale(1.05) translateY(-2px)' : 'none',
        animation: 'benchPlace 0.2s ease-out forwards',
        border: '2px solid #1A1A1A',
        borderRadius: '8px',
        background: '#FFFFFF'
      }}
    >
      <svg width="100%" height="72" viewBox="0 0 112 72" style={{ maxWidth: '144px', filter: filterStyle }}>
        <line x1="14" y1="12" x2="14" y2="34" stroke="#8A561D" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="98" y1="12" x2="98" y2="34" stroke="#8A561D" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="8" y="6" width="96" height="20" rx="3" fill="url(#deskWood)" stroke="#A06428" strokeWidth="1" />
        <rect x="10" y="8" width="92" height="5" fill="#FFE1B3" opacity="0.15" />
        <path d="M18,46 L38,46" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" />
        <rect x="16" y="32" width="24" height="14" rx="4" fill="url(#chairWood)" stroke="#6E3D0D" strokeWidth="0.8" />
        <path d="M74,46 L94,46" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" />
        <rect x="72" y="32" width="24" height="14" rx="4" fill="url(#chairWood)" stroke="#6E3D0D" strokeWidth="0.8" />
        <circle cx="56" cy="16" r="8" fill="#FFFFFF" stroke={isDeleteMode ? '#EF4444' : '#E5A65D'} strokeWidth="1.5" />
        <text x="56" y="19" textAnchor="middle" fontSize="9px" fontWeight="900" fill={isDeleteMode ? '#EF4444' : '#B42B6A'} fontFamily="'JetBrains Mono', monospace">
          {label}
        </text>
      </svg>
    </div>
  );
});

/* ── Ghost Bench Outline for Empty/Unplaced Cells ── */
const EmptyCell = memo(function EmptyCell({ hovered, row, col, onClick, previewType = 'SB' }) {
  return (
    <div
      onClick={() => onClick(row, col)}
      style={{
        width: '100%',
        height: '76px',
        background: hovered ? 'rgba(27, 10, 18, 0.02)' : '#FAFAFA',
        border: '2px solid #1A1A1A',
        borderRadius: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
        position: 'relative'
      }}
    >
      <div style={{ opacity: hovered ? 0.35 : 0.12, transition: 'opacity 0.15s', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {previewType === 'SB' ? (
          <svg width="68" height="72" viewBox="0 0 68 72" fill="none">
            <rect x="8" y="6" width="52" height="20" rx="3" stroke="#1A1A1A" strokeWidth="2" strokeDasharray="3 2" />
            <rect x="22" y="32" width="24" height="14" rx="4" stroke="#1A1A1A" strokeWidth="2" strokeDasharray="3 2" />
          </svg>
        ) : (
          <svg width="112" height="72" viewBox="0 0 112 72" fill="none">
            <rect x="8" y="6" width="96" height="20" rx="3" stroke="#1A1A1A" strokeWidth="2" strokeDasharray="3 2" />
            <rect x="16" y="32" width="24" height="14" rx="4" stroke="#1A1A1A" strokeWidth="2" strokeDasharray="3 2" />
            <rect x="72" y="32" width="24" height="14" rx="4" stroke="#1A1A1A" strokeWidth="2" strokeDasharray="3 2" />
          </svg>
        )}
      </div>

      {hovered && (
        <span style={{ position: 'absolute', fontSize: '18px', color: '#B42B6A', fontWeight: '900', zIndex: 5 }}>+</span>
      )}
    </div>
  );
});

/* ─────────────────────────────────────────
   Teacher Desk Top-View Component
   ───────────────────────────────────────── */
const TeacherDesk = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '10px 0 20px', userSelect: 'none' }}>
    <svg width="120" height="64" viewBox="0 0 120 64" style={{ filter: 'url(#deskShadow)' }}>
      <circle cx="16" cy="12" r="3" fill="#4B5563" />
      <circle cx="104" cy="12" r="3" fill="#4B5563" />
      <rect x="8" y="4" width="104" height="24" rx="4" fill="url(#teacherDeskWood)" stroke="#8A561D" strokeWidth="1" />
      <rect x="42" y="8" width="16" height="12" rx="1" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="0.5" />
      <line x1="50" y1="8" x2="50" y2="20" stroke="#9CA3AF" strokeWidth="0.8" />
      <rect x="64" y="8" width="18" height="11" rx="1.5" fill="#374151" />
      <rect x="68" y="18" width="10" height="1" fill="#9CA3AF" />
      <circle cx="24" cy="14" r="4.5" fill="#C6863F" stroke="#A06428" strokeWidth="0.5" />
      <circle cx="24" cy="14" r="3.5" fill="#10B981" />
      <path d="M22,14 Q24,11 25,12" stroke="#047857" strokeWidth="0.8" fill="none" />
      <path d="M48,46 L72,46" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="48" y="32" width="24" height="14" rx="5" fill="#8A561D" stroke="#5C3810" strokeWidth="1" />
    </svg>
    <div style={{ fontSize: '9px', fontWeight: '700', color: '#1A1A1A', letterSpacing: '0.8px', textTransform: 'uppercase', marginTop: '4px' }}>
      Teacher Table
    </div>
  </div>
);

/* ─────────────────────────────────────────
   SVG Door Asset
   ───────────────────────────────────────── */
const SVGDoor = ({ style }) => (
  <div style={{ position: 'absolute', display: 'flex', alignItems: 'center', gap: '4px', background: '#FFFFFF', border: '2px solid #1A1A1A', borderRadius: '50px', padding: '3px 8px', fontSize: '9px', fontWeight: '800', color: '#1A1A1A', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', zIndex: 5, ...style }}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
    DOOR
  </div>
);

const iconBtn = (active, color) => ({
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '9px 12px', borderRadius: '10px', textAlign: 'left',
  border: `1.5px solid ${active ? color : '#E8E2E5'}`,
  background: active ? `${color}18` : 'white',
  color: active ? '#1B0A12' : '#6B5E63',
  fontWeight: '700', fontSize: '12px', cursor: 'pointer',
  boxShadow: active ? `0 2px 8px ${color}33` : 'none',
  transition: 'all 0.15s', width: '100%',
});

const outlineBtn = (disabled) => ({
  display: 'flex', alignItems: 'center', gap: '6px',
  padding: '7px 11px', borderRadius: '9px',
  border: '1.5px solid #E8E2E5', background: 'white',
  color: disabled ? '#9B8F94' : '#6B5E63',
  fontWeight: '700', fontSize: '12px',
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  transition: 'all 0.12s',
});

/* ─────────────────────────────────────────
   Main component
   ───────────────────────────────────────── */
const HallLayoutDesigner = () => {
  const [searchParams] = useSearchParams();

  const [halls, setHalls]               = useState([]);
  const [selectedHall, setSelectedHall] = useState('');
  const [rows, setRows]                 = useState(6);
  const [cols, setCols]                 = useState(6);
  const [benches, setBenches]           = useState(new Map());
  const [mode, setMode]                 = useState('addSB');
  const [saving, setSaving]             = useState(false);
  const [dirty, setDirty]               = useState(false);
  const [pendingHall, setPendingHall]   = useState(null); // hall name awaiting unsaved-changes confirmation
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false); // "Clear Layout" confirmation modal
  const [deleteHallConfirmOpen, setDeleteHallConfirmOpen] = useState(false); // "Delete Hall" confirmation modal
  const [deletingHall, setDeletingHall] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [hoveredCell, setHoveredCell]   = useState(null);
  const [selectedCellKey, setSelectedCellKey] = useState(null);

  // Zoom feature state
  const [zoom, setZoom]                 = useState(typeof window !== 'undefined' && window.innerWidth < 768 ? 0.45 : 1.0);

  // Inline hall creation
  const [newHallName, setNewHallName]   = useState('');
  const [creating, setCreating]         = useState(false);

  // Responsive mobile states
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [isTablet, setIsTablet] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 && window.innerWidth <= 1100 : false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsTablet(window.innerWidth > 768 && window.innerWidth <= 1100);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /* ── Sticky stacking: measure header + toolbar heights so the toolbar
     sits directly below the navbar/header and the sidebar sits directly
     below the toolbar, without hardcoding pixel offsets that would break
     on wrap/resize. ── */
  const headerRef  = useRef(null);
  const toolbarRef = useRef(null);
  const [navH, setNavH] = useState(0);

  /* Only the sidebar remains sticky (a tool palette that should stay
     reachable while the canvas scrolls) — it sticks just below the
     app's own sticky Navbar. */
  useEffect(() => {
    const measure = () => {
      const navEl = document.querySelector('header.no-print');
      setNavH(navEl?.offsetHeight || 0);
    };
    measure();
    const navEl = document.querySelector('header.no-print');
    const ro = new ResizeObserver(measure);
    if (navEl) ro.observe(navEl);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  /* ── Load halls list ── */
  useEffect(() => {
    api.get('/halls')
      .then(r => setHalls(r.data))
      .catch(() => toast.error('Failed to load halls'));
  }, []);

  /* ── Auto-select hall from ?hall= query param ── */
  useEffect(() => {
    const paramHall = searchParams.get('hall');
    if (paramHall && halls.length > 0) {
      const found = halls.find(h => h.hallName === paramHall);
      if (found) setSelectedHall(paramHall);
    }
  }, [searchParams, halls]);

  /* ── Load existing layout when hall changes ── */
  useEffect(() => {
    if (!selectedHall) return;
    setLoading(true);
    api.get(`/hall-layouts/${encodeURIComponent(selectedHall)}`)
      .then(r => {
        const layout = r.data;
        setRows(layout.rows);
        setCols(layout.cols);
        const map = new Map();
        (layout.benches || []).forEach(b => {
          map.set(`${b.row}_${b.col}`, { ...b });
        });
        setBenches(map);
        setDirty(false);
      })
      .catch(err => {
        if (err.response?.status === 404) {
          // No saved layout yet for this hall — start from a blank grid.
          setBenches(new Map());
          setDirty(false);
        } else {
          toast.error('Failed to load layout');
        }
      })
      .finally(() => setLoading(false));
  }, [selectedHall]);

  /* ── Inline hall creation ── */
  const handleCreateHall = async () => {
    const name = newHallName.trim();
    if (!name) { toast.warn('Enter a hall name'); return; }
    setCreating(true);
    try {
      await api.post('/halls', { hallName: name });
      const r = await api.get('/halls');
      setHalls(r.data);
      setSelectedHall(name);
      setNewHallName('');
      toast.success(`Hall "${name}" created`);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create hall');
    } finally {
      setCreating(false);
    }
  };

  /* ── Cell click ── */
  const handleCellClick = useCallback((row, col) => {
    if (!selectedHall) { toast.warn('Please select a hall first'); return; }
    const key = `${row}_${col}`;
    const updated = new Map(benches);

    if (isMobile) {
      // Toggle selectedCellKey on mobile to show BookMyShow adjuster overlay (-/+)
      setSelectedCellKey(prev => prev === key ? null : key);
    }

    if (mode === 'addSB') {
      if (updated.has(key)) { toast.info('Cell already has a bench. Adjust seats using the - / + buttons.'); return; }
      updated.set(key, { id: `bench_${row}_${col}`, row, col, type: 'SB', label: '' });
    } else if (mode === 'addBB') {
      if (updated.has(key)) { toast.info('Cell already has a bench. Adjust seats using the - / + buttons.'); return; }
      updated.set(key, { id: `bench_${row}_${col}`, row, col, type: 'BB', label: '' });
    } else if (mode === 'delete') {
      if (!updated.has(key)) return;
      updated.delete(key);
      setSelectedCellKey(null);
    } else if (mode === 'toggle') {
      if (!updated.has(key)) { toast.info('No bench here. Place one first.'); return; }
      const existing = updated.get(key);
      updated.set(key, { ...existing, type: existing.type === 'SB' ? 'BB' : 'SB' });
    }

    setBenches(computeLabels(updated));
    setDirty(true);
  }, [selectedHall, mode, benches, isMobile]);

  /* ── Plus / Minus BookMyShow Style Actions ── */
  const handleIncreaseSeats = (row, col) => {
    if (!selectedHall) { toast.warn('Please select a hall first'); return; }
    const key = `${row}_${col}`;
    const updated = new Map(benches);
    if (!updated.has(key)) {
      // Empty -> SB (1 seat)
      updated.set(key, { id: `bench_${row}_${col}`, row, col, type: 'SB', label: '' });
    } else {
      const existing = updated.get(key);
      if (existing.type === 'SB') {
        // SB (1 seat) -> BB (2 seats)
        updated.set(key, { ...existing, type: 'BB' });
      }
    }
    setBenches(computeLabels(updated));
    setDirty(true);
  };

  const handleDecreaseSeats = (row, col) => {
    if (!selectedHall) { toast.warn('Please select a hall first'); return; }
    const key = `${row}_${col}`;
    const updated = new Map(benches);
    if (updated.has(key)) {
      const existing = updated.get(key);
      if (existing.type === 'BB') {
        // BB (2 seats) -> SB (1 seat)
        updated.set(key, { ...existing, type: 'SB' });
      } else {
        // SB (1 seat) -> Empty
        updated.delete(key);
      }
    }
    setBenches(computeLabels(updated));
    setDirty(true);
  };

  /* ── Row / Col controls ── */
  const handleAddRow = () => {
    setRows(r => r + 1);
    setDirty(true);
  };

  const handleRemoveRow = () => {
    if (rows <= 1) return;
    const newR = rows - 1;
    const updated = new Map(benches);
    updated.forEach((_, key) => {
      const [r] = key.split('_').map(Number);
      if (r >= newR) updated.delete(key);
    });
    setRows(newR);
    setBenches(computeLabels(updated));
    setDirty(true);
  };

  const handleAddCol = () => {
    setCols(c => c + 1);
    setDirty(true);
  };

  const handleRemoveCol = () => {
    if (cols <= 1) return;
    const newC = cols - 1;
    const updated = new Map(benches);
    updated.forEach((_, key) => {
      const [, c] = key.split('_').map(Number);
      if (c >= newC) updated.delete(key);
    });
    setCols(newC);
    setBenches(computeLabels(updated));
    setDirty(true);
  };

  /* ── Fill helpers ── */
  const handleFillSB = () => {
    if (!selectedHall) { toast.warn('Select a hall first'); return; }
    const updated = new Map(benches);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${r}_${c}`;
        if (!updated.has(key)) {
          updated.set(key, { id: `bench_${r}_${c}`, row: r, col: c, type: 'SB', label: '' });
        }
      }
    }
    setBenches(computeLabels(updated));
    setDirty(true);
  };

  const handleFillBB = () => {
    if (!selectedHall) { toast.warn('Select a hall first'); return; }
    const updated = new Map(benches);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${r}_${c}`;
        if (!updated.has(key)) {
          updated.set(key, { id: `bench_${r}_${c}`, row: r, col: c, type: 'BB', label: '' });
        }
      }
    }
    setBenches(computeLabels(updated));
    setDirty(true);
  };

  const handleClearAll = () => {
    setClearConfirmOpen(true);
  };

  const confirmClearAll = () => {
    setBenches(new Map());
    setDirty(true);
    setClearConfirmOpen(false);
  };

  /* ── Delete whole hall ── */
  const handleDeleteHall = () => {
    if (!selectedHall) return;
    setDeleteHallConfirmOpen(true);
  };

  const confirmDeleteHall = async () => {
    const hallObj = halls.find(h => h.hallName === selectedHall);
    if (!hallObj) { setDeleteHallConfirmOpen(false); return; }
    setDeletingHall(true);
    try {
      await api.delete(`/halls/${hallObj._id}`);
      try { await api.delete(`/hall-layouts/${encodeURIComponent(selectedHall)}`); } catch { /* no saved layout — fine */ }
      setHalls(prev => prev.filter(h => h._id !== hallObj._id));
      toast.success(`Hall "${selectedHall}" deleted`);
      setSelectedHall('');
      setBenches(new Map());
      setDirty(false);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to delete hall');
    } finally {
      setDeletingHall(false);
      setDeleteHallConfirmOpen(false);
    }
  };

  /* ── Save ── */
  const handleSave = async () => {
    if (!selectedHall) { toast.warn('Please select a hall first'); return; }
    setSaving(true);
    try {
      await api.put(`/hall-layouts/${encodeURIComponent(selectedHall)}`, {
        rows, cols,
        benches: [...benches.values()],
      });
      setDirty(false);
      toast.success('Layout saved successfully.');
    } catch {
      toast.error('Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  /* ── Unsaved-changes switch-hall confirmation (custom modal, not
     window.confirm) ── */
  const requestHallSwitch = (nextHall) => {
    if (dirty) {
      setPendingHall(nextHall);
    } else {
      setSelectedHall(nextHall);
    }
  };
  const confirmHallSwitch = () => {
    setSelectedHall(pendingHall);
    setPendingHall(null);
  };
  const cancelHallSwitch = () => setPendingHall(null);

  /* ── Computed values ── */
  const totalSeats   = computeTotalSeats(benches);
  const totalBenches = benches.size;

  /* ── Grid cell size (responsive/fluid look) ── */
  const cellW = Math.min(180, Math.max(100, Math.floor(1100 / Math.max(cols, 1))));

  /* ── Zoom triggers ── */
  const zoomIn = () => setZoom(z => Math.min(1.5, z + 0.1));
  const zoomOut = () => setZoom(z => Math.max(0.25, z - 0.1));
  const resetZoom = () => setZoom(isMobile ? 0.45 : 1);

  // Pick the preview ghost type based on current add mode
  const getPreviewGhostType = () => {
    if (mode === 'addBB') return 'BB';
    return 'SB';
  };
  const ghostType = getPreviewGhostType();

  // Tablet collapses the right sidebar into the bottom action bar (same as mobile)
  const isCompact = isMobile || isTablet;

  return (
    <m.div
      variants={staggerContainer(0.06)}
      initial="hidden"
      animate="visible"
      style={{
        // No flat fill of its own — inherits the page's background so
        // the header/toolbar area never reads as a separate tinted
        // panel against the rest of the app shell.
        background: 'transparent',
        minHeight: '100%',
      }}
    >
      <SVGDefs />

      {/* ── Header — plain typography, no card, no icon, scrolls with the
           page like the rest of the content. ── */}
      <div ref={headerRef}>
      <m.div variants={fadeUp} style={{
        padding: '20px 20px 14px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{
            fontFamily: "'Playfair Display',Georgia,serif",
            fontWeight: 800, fontSize: 'clamp(18px,2.5vw,24px)',
            color: '#1B0A12', margin: 0, lineHeight: 1.2,
          }}>
            Hall Layout Designer
          </h2>
          <p style={{ color: '#9B8F94', fontSize: 12, margin: '2px 0 0' }}>PSNA College · Bench Layout Manager</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', flexShrink: 0 }}>
          {!isMobile && (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ fontSize: 13, color: '#6B5E63' }}>
              <strong style={{ color: COLORS.primary, fontSize: 15 }}>{totalBenches}</strong> benches
            </span>
            <div style={{ width: 1, height: 16, background: '#E8E2E5' }} />
            <span style={{ fontSize: 13, color: '#6B5E63' }}>
              <strong style={{ color: COLORS.primary, fontSize: 15 }}>{totalSeats}</strong> seats
            </span>
          </div>
          )}

          {dirty && !isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#D97706', fontWeight: 700, whiteSpace: 'nowrap' }}>
              <FiAlertCircle size={11} /> Unsaved
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !selectedHall || !dirty}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: isMobile ? '8px 12px' : '8px 16px', borderRadius: 50, border: 'none',
              background: saving || !selectedHall || !dirty ? '#E8E2E5' : `linear-gradient(135deg,${COLORS.primary},#9A2259)`,
              color: saving || !selectedHall || !dirty ? '#9B8F94' : 'white',
              fontWeight: 700, fontSize: 12,
              cursor: saving || !selectedHall || !dirty ? 'default' : 'pointer',
              boxShadow: saving || !selectedHall || !dirty ? 'none' : '0 4px 12px rgba(180,43,106,0.28)',
              transition: 'all 0.2s', whiteSpace: 'nowrap',
            }}
          >
            <FiSave size={12} />
            {saving ? 'Saving…' : (isMobile ? 'Save' : 'Save Layout')}
          </button>
        </div>
      </m.div>
      </div>

      {/* ── Hall selector bar — blends with the page, no card background ── */}
      <m.div variants={fadeUp} style={{
        padding: '0 20px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
      }}>
        <div style={{ flex: '1 1 160px', minWidth: 140 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#9B8F94', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 4 }}>
            Select Hall
          </label>
          <select
            value={selectedHall}
            onChange={e => requestHallSwitch(e.target.value)}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 9,
              border: '1.5px solid #E8E2E5', fontSize: 13, fontWeight: 600,
              color: '#1B0A12', background: 'white', outline: 'none', cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            <option value="">— Choose a hall —</option>
            {halls.map(h => (
              <option key={h._id} value={h.hallName}>{h.hallName}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1 1 180px', minWidth: 160 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#9B8F94', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 4 }}>
            Create New Hall
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={newHallName}
              onChange={e => setNewHallName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateHall()}
              placeholder="e.g. CSE Lab 1"
              style={{
                flex: 1, padding: '8px 10px', borderRadius: 9,
                border: '1.5px solid #E8E2E5', fontSize: 13,
                fontWeight: 600, color: '#1B0A12', outline: 'none',
                background: '#FAFAFA', minWidth: 0, boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleCreateHall}
              disabled={creating || !newHallName.trim()}
              style={{
                padding: '8px 14px', borderRadius: 9, border: 'none',
                background: creating || !newHallName.trim() ? '#E8E2E5' : `linear-gradient(135deg,${COLORS.primary},#9A2259)`,
                color: creating || !newHallName.trim() ? '#9B8F94' : 'white',
                fontWeight: 700, fontSize: 12,
                cursor: creating || !newHallName.trim() ? 'default' : 'pointer',
                whiteSpace: 'nowrap', flexShrink: 0,
                boxShadow: creating || !newHallName.trim() ? 'none' : '0 3px 10px rgba(180,43,106,0.22)',
                transition: 'all 0.15s',
              }}
            >
              {creating ? '…' : 'Create'}
            </button>
          </div>
        </div>

        {!dirty && benches.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#16A34A', fontWeight: 700, paddingBottom: 4, flexShrink: 0 }}>
            <FiCheckCircle size={13} /> Saved
          </div>
        )}
      </m.div>

      {/* ── Body (normal document flow — the page itself scrolls) ── */}
      <m.div variants={fadeUp} style={{ display: 'flex', gap: 0 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: '#9B8F94', fontSize: '14px', fontWeight: '600' }}>
              Loading layout…
            </div>
          ) : !selectedHall ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'flex-start',
              color: '#9B8F94', gap: '14px', padding: '20px',
              paddingTop: '80px'
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: '20px',
                background: '#F3F4F6', border: '1.5px dashed #D1D5DB',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FiGrid size={32} color="#D1D5DB" />
              </div>
              <div style={{ fontWeight: '700', fontSize: '16px', color: '#6B5E63' }}>Select a hall to begin</div>
              <div style={{ fontSize: '13px', color: '#9B8F94', textAlign: 'center', maxWidth: 320 }}>
                Choose an existing hall from the dropdown above or create a new one, then design its bench layout below.
              </div>
            </div>
          ) : (
            <>
              {/* ── Compact-only (Tablet/Mobile): Bench Editing section — normal
                   document flow, directly above the Rows/Cols/Zoom toolbar.
                   Replaces the old floating right sidebar / fixed bottom sheet. ── */}
              {isCompact && (
                <div style={{
                  padding: '0 20px 16px',
                }}>
                  <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#9B8F94', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
                    Bench Editing
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <button onClick={() => setMode('addSB')} style={{ border: mode === 'addSB' ? '2px solid #B42B6A' : '1px solid #E8E2E5', borderRadius: 8, padding: '7px 12px', background: mode === 'addSB' ? '#FDF2F7' : 'white', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: mode === 'addSB' ? '#B42B6A' : '#1B0A12' }}>+ Small Bench</button>
                    <button onClick={() => setMode('addBB')} style={{ border: mode === 'addBB' ? '2px solid #B42B6A' : '1px solid #E8E2E5', borderRadius: 8, padding: '7px 12px', background: mode === 'addBB' ? '#FDF2F7' : 'white', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: mode === 'addBB' ? '#B42B6A' : '#1B0A12' }}>+ Big Bench</button>
                    <button onClick={() => setMode('toggle')} style={{ border: mode === 'toggle' ? '2px solid #B42B6A' : '1px solid #E8E2E5', borderRadius: 8, padding: '7px 12px', background: mode === 'toggle' ? '#FDF2F7' : 'white', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: mode === 'toggle' ? '#B42B6A' : '#1B0A12' }}>Swap Type</button>
                    <button onClick={() => setMode('delete')} style={{ border: mode === 'delete' ? '2px solid #EF4444' : '1px solid #E8E2E5', borderRadius: 8, padding: '7px 12px', background: mode === 'delete' ? '#FEE2E2' : 'white', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: '#EF4444' }}>Delete Bench</button>
                    <button onClick={handleFillSB} disabled={!selectedHall} style={{ border: '1px solid #E8E2E5', borderRadius: 8, padding: '7px 12px', background: 'white', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: '#1B0A12', opacity: !selectedHall ? 0.5 : 1 }}>Fill SB</button>
                    <button onClick={handleFillBB} disabled={!selectedHall} style={{ border: '1px solid #E8E2E5', borderRadius: 8, padding: '7px 12px', background: 'white', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: '#1B0A12', opacity: !selectedHall ? 0.5 : 1 }}>Fill BB</button>
                    <button onClick={handleClearAll} disabled={benches.size === 0} style={{ border: '1px solid #EF4444', borderRadius: 8, padding: '7px 12px', background: 'white', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: '#EF4444', opacity: benches.size === 0 ? 0.5 : 1 }}>Clear Layout</button>
                    <button onClick={handleDeleteHall} disabled={!selectedHall} style={{ border: '1px solid #EF4444', borderRadius: 8, padding: '7px 12px', background: '#EF4444', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: 'white', opacity: !selectedHall ? 0.5 : 1 }}>Delete Hall</button>
                  </div>
                </div>
              )}

              {!isCompact ? (
              /* ── Desktop: Dimensions / Zoom controls — blends with the
                   page, scrolls with the content, no card background.
                   position:relative + zIndex so this paints above the
                   canvas row's ambient-glow background below it, which
                   bleeds upward via a negative-margin trick and would
                   otherwise visually cover this toolbar (same DOM-order
                   painting issue fixed on the compact toolbar too). ── */
              <div ref={toolbarRef} style={{ position: 'relative', zIndex: 1 }}>
              <div style={{
                padding: '0 20px 16px',
                display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#9B8F94', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Grid Dimensions
                </span>

                {/* Rows */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <button onClick={handleRemoveRow} disabled={rows <= 1} style={{ ...controlBtn, opacity: rows <= 1 ? 0.4 : 1 }}>
                    <FiMinus size={11} />
                  </button>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#1B0A12', minWidth: '60px', textAlign: 'center' }}>
                    {rows} Rows
                  </span>
                  <button onClick={handleAddRow} disabled={rows >= 30} style={{ ...controlBtn, opacity: rows >= 30 ? 0.4 : 1 }}>
                    <FiPlus size={11} />
                  </button>
                </div>

                <div style={{ width: 1, height: 18, background: '#E8E2E5' }} />

                {/* Cols */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <button onClick={handleRemoveCol} disabled={cols <= 1} style={{ ...controlBtn, opacity: cols <= 1 ? 0.4 : 1 }}>
                    <FiMinus size={11} />
                  </button>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#1B0A12', minWidth: '60px', textAlign: 'center' }}>
                    {cols} Cols
                  </span>
                  <button onClick={handleAddCol} disabled={cols >= 20} style={{ ...controlBtn, opacity: cols >= 20 ? 0.4 : 1 }}>
                    <FiPlus size={11} />
                  </button>
                </div>

                <div style={{ width: 1, height: 18, background: '#E8E2E5' }} />

                {/* Quick Fills */}
                <button onClick={handleFillSB} disabled={!selectedHall} style={{ ...outlineBtn(!selectedHall), fontSize: '11px', padding: '5px 10px' }}>Fill SB</button>
                <button onClick={handleFillBB} disabled={!selectedHall} style={{ ...outlineBtn(!selectedHall), fontSize: '11px', padding: '5px 10px' }}>Fill BB</button>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#9B8F94' }}>
                  <FiInfo size={11} />
                  Click cell or hover to adjust seats (- / +)
                </div>
              </div>
              </div>
              ) : (
              /* ── Compact-only: Rows / Columns / Zoom toolbar — normal document
                   flow (not sticky, not fixed), directly above the hall layout. ── */
              <div ref={toolbarRef} style={{
                position: 'relative', zIndex: 1,
                padding: '10px 14px',
                background: '#FAFAFA',
                borderBottom: '1px solid #E8E2E5',
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px',
              }}>
                {/* Rows */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#9B8F94', textTransform: 'uppercase', letterSpacing: '0.6px', marginRight: '2px' }}>Rows</span>
                  <button onClick={handleRemoveRow} disabled={rows <= 1} style={{ ...controlBtn, opacity: rows <= 1 ? 0.4 : 1 }}>
                    <FiMinus size={11} />
                  </button>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#1B0A12', minWidth: '18px', textAlign: 'center' }}>
                    {rows}
                  </span>
                  <button onClick={handleAddRow} disabled={rows >= 30} style={{ ...controlBtn, opacity: rows >= 30 ? 0.4 : 1 }}>
                    <FiPlus size={11} />
                  </button>
                </div>

                <div style={{ width: 1, height: 18, background: '#E8E2E5' }} />

                {/* Cols */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#9B8F94', textTransform: 'uppercase', letterSpacing: '0.6px', marginRight: '2px' }}>Cols</span>
                  <button onClick={handleRemoveCol} disabled={cols <= 1} style={{ ...controlBtn, opacity: cols <= 1 ? 0.4 : 1 }}>
                    <FiMinus size={11} />
                  </button>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#1B0A12', minWidth: '18px', textAlign: 'center' }}>
                    {cols}
                  </span>
                  <button onClick={handleAddCol} disabled={cols >= 20} style={{ ...controlBtn, opacity: cols >= 20 ? 0.4 : 1 }}>
                    <FiPlus size={11} />
                  </button>
                </div>

                <div style={{ width: 1, height: 18, background: '#E8E2E5' }} />

                {/* Zoom — compact/responsive only, per spec */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#9B8F94', textTransform: 'uppercase', letterSpacing: '0.6px', marginRight: '2px' }}>Zoom</span>
                  <button onClick={zoomOut} style={controlBtn} title="Zoom Out"><FiZoomOut size={11} /></button>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#1B0A12', minWidth: '36px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                  <button onClick={zoomIn} style={controlBtn} title="Zoom In"><FiZoomIn size={11} /></button>
                  <button onClick={resetZoom} style={{ ...outlineBtn(false), fontSize: '10px', padding: '4px 8px' }} title="Reset Zoom">Reset</button>
                </div>
              </div>
              )}
              {/* end toolbar */}

              {/* ── Canvas + sidebar row. Canvas scrolls horizontally ONLY (for wide
                   grids); vertical scroll belongs to the page, not this container —
                   this is the single-scroll fix. The sidebar lives OUTSIDE this
                   horizontal scroller so it isn't dragged along when the grid pans. ── */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 0,
                position: 'relative',
                padding: '48px 0',
                margin: '-48px 0',
                // Soft ambient lighting behind the whole row, mirrored
                // top AND bottom — pink on the left, blue on the right —
                // spanning the canvas AND the Edit Mode sidebar. Wide,
                // very gradual fades (no hard-edged stop) so it reads as
                // a soft glow rather than a rectangular color block; the
                // extra vertical padding (offset by an equal negative
                // margin, so layout is unaffected) gives the gradients
                // room to fade out before the container edge.
                background: `
                  radial-gradient(ellipse 640px 420px at 0% 0%, rgba(194,24,91,0.16) 0%, transparent 78%),
                  radial-gradient(ellipse 640px 420px at 100% 0%, rgba(37,99,235,0.15) 0%, transparent 78%),
                  radial-gradient(ellipse 640px 420px at 0% 100%, rgba(194,24,91,0.14) 0%, transparent 78%),
                  radial-gradient(ellipse 640px 420px at 100% 100%, rgba(37,99,235,0.13) 0%, transparent 78%),
                  #FDFDFE
                `,
              }}>
              <div className="hall-canvas-scroll" style={{
                overflowX: 'auto',
                padding: isMobile ? '16px 12px 24px' : '28px',
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                // On tablet/mobile the grid frequently overflows the
                // scroller; centering it there clips the left edge (incl.
                // the ROOM info card) because scrollLeft can't go negative
                // to reach it. flex-start keeps the full canvas reachable
                // from scroll position 0. Desktop keeps centering, where
                // the wider canvas area means most grids fit without
                // overflow.
                justifyContent: isCompact ? 'flex-start' : 'center',
                alignItems: 'flex-start',
                gap: '24px',
                position: 'relative',
              }}>

                {/* ── Grid Wrapper (Full Space Classroom with Merged BG) ── */}
                <div style={{
                  zoom: zoom,
                  transition: 'zoom 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: isMobile ? '20px 16px' : '30px 40px',
                  position: 'relative',
                  width: 'fit-content',
                  minWidth: `${(cols * cellW) + (isMobile ? 32 : 80)}px`,
                  border: '2px solid #1A1A1A',
                  borderRadius: '20px',
                  // Glassmorphism — translucent + blurred, letting the
                  // ambient pink/blue lighting behind the canvas show
                  // through softly, with a uniquely-colored pink+blue
                  // dual shadow (instead of a plain neutral one) for a
                  // premium, elevated feel.
                  background: 'rgba(255,255,255,0.75)',
                  backdropFilter: 'blur(20px) saturate(1.4)',
                  WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
                  boxShadow: '0 32px 64px -12px rgba(194,24,91,0.28), -18px 20px 56px -16px rgba(194,24,91,0.22), 18px 20px 56px -16px rgba(37,99,235,0.22), 0 4px 16px rgba(27,10,18,0.06)',
                  flexShrink: 0
                }}>
                  {/* Room spec card — its own row, left-aligned, so it no
                      longer competes with the blackboard for horizontal
                      space (that was pushing the blackboard off-center). */}
                  <div style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: isMobile ? 'center' : 'flex-start',
                    marginBottom: '14px',
                  }}>
                    <div style={{
                      border: '2px solid #1A1A1A',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      background: '#FFFFFF',
                      fontSize: '11px',
                      fontFamily: "'JetBrains Mono', monospace",
                      color: '#1A1A1A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      width: isMobile ? '100%' : 'auto',
                      minWidth: isMobile ? 'auto' : '290px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                      boxSizing: 'border-box',
                      flexShrink: 0
                    }}>
                      <span style={{ fontWeight: '900', color: '#B42B6A' }}>ROOM: {selectedHall || 'N/A'}</span>
                      <span style={{ color: '#1A1A1A', opacity: 0.3 }}>|</span>
                      <span>BENCHES: <span style={{ fontWeight: '900' }}>{totalBenches}</span></span>
                      <span style={{ color: '#1A1A1A', opacity: 0.3 }}>|</span>
                      <span>STUDENTS: <span style={{ fontWeight: '900', color: '#B42B6A' }}>{totalSeats}</span></span>
                    </div>
                  </div>

                  {/* Blackboard row — full width, independently centered so
                      its true center matches the grid/teacher-table center
                      below (one shared vertical axis), with the Door badge
                      pinned to the top-right, aligned with it. */}
                  <div style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    position: 'relative',
                    marginBottom: '14px',
                    zIndex: 2,
                  }}>
                    <div style={{ width: '100%', maxWidth: '340px', height: '14px', background: '#1E3A2F', borderRadius: '4px', border: '2px solid #8A561D', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FAFAFA', fontSize: '8px', fontWeight: '800', letterSpacing: '2.5px', boxShadow: '0 3px 6px rgba(0,0,0,0.15)', userSelect: 'none' }}>
                      BLACKBOARD
                    </div>
                    <SVGDoor style={{ right: '0px', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>

                  {/* Teacher Desk — centered on the same axis as the grid
                      and blackboard above. */}
                  <TeacherDesk />

                  {/* Column Labels — above the first bench row */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${cols}, ${cellW}px)`,
                    gap: '12px',
                    marginBottom: '8px',
                    zIndex: 1,
                    width: '100%',
                    justifyContent: 'center'
                  }}>
                    {Array.from({ length: cols }, (_, c) => (
                      <div key={c} style={{
                        textAlign: 'center', fontWeight: '800', fontSize: '11px', color: COLORS.primary,
                        borderBottom: `2px solid ${COLORS.primary}`, paddingBottom: '4px', userSelect: 'none',
                        fontFamily: "'JetBrains Mono', monospace"
                      }}>
                        {String.fromCharCode(65 + c)}
                      </div>
                    ))}
                  </div>

                  {/* Centered Bench Layout Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateRows: `repeat(${rows}, 76px)`,
                    gridTemplateColumns: `repeat(${cols}, ${cellW}px)`,
                    gap: '12px',
                    justifyContent: 'center', // Centered grid inside the walls
                    zIndex: 1,
                    position: 'relative',
                    width: '100%'
                  }}>
                    {Array.from({ length: rows }, (_, r) =>
                      Array.from({ length: cols }, (_, c) => {
                        const key = `${r}_${c}`;
                        const bench = benches.get(key);
                        const hovered = hoveredCell === key;

                        return (
                          <div
                            key={key}
                            style={{ position: 'relative' }}
                            onMouseEnter={() => setHoveredCell(key)}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            {/* Simple premium tooltip — appears directly above
                                this bench, no icons or animation beyond a fast
                                fade. */}
                            {hovered && bench && !isMobile && (
                              <div style={{
                                position: 'absolute',
                                bottom: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                marginBottom: '8px',
                                width: '150px',
                                background: 'white',
                                border: '1px solid #E8E2E5',
                                borderRadius: '10px',
                                boxShadow: '0 4px 16px rgba(27,10,18,0.1)',
                                padding: '9px 11px',
                                zIndex: 100,
                                animation: 'tooltipFade 0.1s ease',
                                pointerEvents: 'none',
                              }}>
                                <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#1B0A12', marginBottom: '3px' }}>
                                  {bench.type === 'SB' ? 'Small Bench' : 'Big Bench'}
                                </div>
                                <div style={{ fontSize: '11px', color: '#6B5E63' }}>
                                  Seats: <strong style={{ color: '#1B0A12' }}>{bench.type === 'SB' ? 1 : 2}</strong>
                                </div>
                                <div style={{ fontSize: '11px', color: '#6B5E63', marginTop: '2px' }}>
                                  Position:
                                </div>
                                <div style={{ fontSize: '11px', color: '#1B0A12', fontWeight: '600' }}>
                                  Row {r + 1}
                                </div>
                                <div style={{ fontSize: '11px', color: '#1B0A12', fontWeight: '600' }}>
                                  Column {String.fromCharCode(65 + c)}
                                </div>
                              </div>
                            )}

                            {/* Cells */}
                            {!bench ? (
                              <EmptyCell hovered={hovered} row={r} col={c} onClick={handleCellClick} previewType={ghostType} />
                            ) : bench.type === 'SB' ? (
                              <SBCell label={bench.label} hovered={hovered} mode={mode} row={r} col={c} onClick={handleCellClick} />
                            ) : (
                              <BBCell label={bench.label} hovered={hovered} mode={mode} row={r} col={c} onClick={handleCellClick} />
                            )}

                            {/* BookMyShow Style Floating Seat Selector overlay (- / +) */}
                            {(hovered || selectedCellKey === key) && (
                              <div style={{
                                position: 'absolute',
                                bottom: '-4px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: 'white',
                                border: '1.5px solid #1A1A1A',
                                boxShadow: '0 4px 14px rgba(27,10,18,0.12)',
                                borderRadius: '50px',
                                padding: '3px 7px',
                                zIndex: 20,
                                animation: 'fadeDown 0.12s cubic-bezier(0.16, 1, 0.3, 1)'
                              }}>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDecreaseSeats(r, c); }}
                                  style={{ width: '18px', height: '18px', borderRadius: '50%', border: '1.5px solid #E8E2E5', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer', fontWeight: '900', color: '#1A1A1A', outline: 'none', lineHeight: 1 }}
                                >
                                  -
                                </button>
                                <span style={{ fontSize: '10px', fontWeight: '900', color: '#B42B6A', minWidth: '10px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
                                  {bench ? (bench.type === 'SB' ? '1' : '2') : '0'}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleIncreaseSeats(r, c); }}
                                  style={{ width: '18px', height: '18px', borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,#B42B6A,#9A2259)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', cursor: 'pointer', fontWeight: '900', outline: 'none', lineHeight: 1 }}
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                </div>
              </div>
              {/* end horizontal-scroll canvas container */}

                {/* Sticky right sidebar — pinned below header+toolbar, independent of
                    the canvas's horizontal scroll and the page's vertical scroll. */}
                {!isCompact && (
                  <div style={{ position: 'sticky', top: navH + 16, alignSelf: 'flex-start', flexShrink: 0, padding: '16px 20px 16px 0' }}>
                  <div style={{
                    width: '200px',
                    border: '3px solid #1A1A1A',
                    borderRadius: '16px',
                    background: 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                    padding: '16px 12px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    fontFamily: "'JetBrains Mono', monospace",
                    boxSizing: 'border-box',
                  }}>
                    <div style={{ fontSize: '10px', fontWeight: '900', color: '#9B8F94', letterSpacing: '0.8px', textTransform: 'uppercase', paddingLeft: '4px' }}>
                      Edit Mode
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <button
                        onClick={() => setMode('addSB')}
                        style={{
                          border: '1.5px solid #1A1A1A',
                          background: mode === 'addSB' ? 'linear-gradient(135deg, #B42B6A, #9A2259)' : '#FFFFFF',
                          color: mode === 'addSB' ? '#FFFFFF' : '#1A1A1A',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          cursor: 'pointer',
                          fontWeight: '700',
                          fontSize: '11px',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s'
                        }}
                      >
                        <span style={{ fontSize: '13px' }}>+</span> Add Small Bench
                      </button>

                      <button
                        onClick={() => setMode('addBB')}
                        style={{
                          border: '1.5px solid #1A1A1A',
                          background: mode === 'addBB' ? 'linear-gradient(135deg, #B42B6A, #9A2259)' : '#FFFFFF',
                          color: mode === 'addBB' ? '#FFFFFF' : '#1A1A1A',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          cursor: 'pointer',
                          fontWeight: '700',
                          fontSize: '11px',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s'
                        }}
                      >
                        <span style={{ fontSize: '13px' }}>+</span> Add Big Bench
                      </button>

                      <button
                        onClick={() => setMode('toggle')}
                        style={{
                          border: '1.5px solid #1A1A1A',
                          background: mode === 'toggle' ? 'linear-gradient(135deg, #B42B6A, #9A2259)' : '#FFFFFF',
                          color: mode === 'toggle' ? '#FFFFFF' : '#1A1A1A',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          cursor: 'pointer',
                          fontWeight: '700',
                          fontSize: '11px',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s'
                        }}
                      >
                        <FiRefreshCw size={11} /> Swap Type
                      </button>

                      <button
                        onClick={() => setMode('delete')}
                        style={{
                          border: '1.5px solid #1A1A1A',
                          background: mode === 'delete' ? 'linear-gradient(135deg, #EF4444, #DC2626)' : '#FFFFFF',
                          color: mode === 'delete' ? '#FFFFFF' : '#1A1A1A',
                          borderRadius: '8px',
                          padding: '8px 10px',
                          cursor: 'pointer',
                          fontWeight: '700',
                          fontSize: '11px',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s'
                        }}
                      >
                        <FiTrash2 size={11} /> Delete Bench
                      </button>
                    </div>

                    <div style={{ height: '1.5px', background: '#1A1A1A', margin: '4px 0' }} />

                    <div style={{ fontSize: '10px', fontWeight: '900', color: '#9B8F94', letterSpacing: '0.8px', textTransform: 'uppercase', paddingLeft: '4px' }}>
                      Quick Fill
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <button
                        onClick={handleFillSB}
                        disabled={!selectedHall}
                        style={{
                          border: '1.5px solid #1A1A1A',
                          background: '#FFFFFF',
                          color: !selectedHall ? '#CBD5E1' : '#1A1A1A',
                          borderRadius: '8px',
                          padding: '7px 10px',
                          cursor: !selectedHall ? 'default' : 'pointer',
                          fontWeight: '700',
                          fontSize: '11px',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          opacity: !selectedHall ? 0.5 : 1
                        }}
                      >
                        <FiCopy size={11} color="#1A1A1A" /> Fill all SB
                      </button>

                      <button
                        onClick={handleFillBB}
                        disabled={!selectedHall}
                        style={{
                          border: '1.5px solid #1A1A1A',
                          background: '#FFFFFF',
                          color: !selectedHall ? '#CBD5E1' : '#1A1A1A',
                          borderRadius: '8px',
                          padding: '7px 10px',
                          cursor: !selectedHall ? 'default' : 'pointer',
                          fontWeight: '700',
                          fontSize: '11px',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          opacity: !selectedHall ? 0.5 : 1
                        }}
                      >
                        <FiCopy size={11} color="#1A1A1A" /> Fill all BB
                      </button>

                      <button
                        onClick={handleClearAll}
                        disabled={benches.size === 0}
                        style={{
                          border: '1.5px solid #EF4444',
                          background: '#FFFFFF',
                          color: benches.size === 0 ? '#CBD5E1' : '#EF4444',
                          borderRadius: '8px',
                          padding: '7px 10px',
                          cursor: benches.size === 0 ? 'default' : 'pointer',
                          fontWeight: '700',
                          fontSize: '11px',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          opacity: benches.size === 0 ? 0.5 : 1
                        }}
                      >
                        <FiTrash2 size={11} /> Clear Layout
                      </button>

                      <button
                        onClick={handleDeleteHall}
                        disabled={!selectedHall}
                        style={{
                          border: '1.5px solid #EF4444',
                          background: '#EF4444',
                          color: 'white',
                          borderRadius: '8px',
                          padding: '7px 10px',
                          cursor: !selectedHall ? 'default' : 'pointer',
                          fontWeight: '700',
                          fontSize: '11px',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          opacity: !selectedHall ? 0.5 : 1
                        }}
                      >
                        <FiTrash2 size={11} color="white" /> Delete Hall
                      </button>
                    </div>
                  </div>
                  </div>
                )}
              </div>
              {/* end canvas+sidebar row */}

              {/* Grid footer */}
              <div style={{
                padding: '10px 20px', borderTop: '1.5px solid #E8E2E5',
                background: '#FAFAFA',
                display: 'flex', gap: '20px', flexWrap: 'wrap',
                fontSize: '12px', color: '#9B8F94', fontWeight: '600',
              }}>
                <span>{rows} rows × {cols} cols</span>
                <span>|</span>
                <span>{totalBenches} benches</span>
                <span>|</span>
                <span>{totalSeats} seats</span>
                {dirty && (
                  <span style={{ marginLeft: 'auto', color: '#D97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FiAlertCircle size={11} /> Unsaved changes
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </m.div>

      {/* ── Unsaved Changes confirmation modal (replaces window.confirm) ── */}
      {pendingHall !== null && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(27,10,18,0.5)',
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
            animation: 'modalBackdropFade 0.18s ease',
          }}
          onClick={e => { if (e.target === e.currentTarget) cancelHallSwitch(); }}
        >
          <div style={{
            background: 'white', borderRadius: '18px', width: '100%', maxWidth: '380px',
            padding: '24px', boxShadow: '0 24px 64px rgba(27,10,18,0.24)',
            animation: 'modalScaleIn 0.2s cubic-bezier(0.34,1.4,0.64,1)',
          }}>
            <h3 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 800, fontSize: '18px', color: '#1B0A12', margin: '0 0 10px' }}>
              Unsaved Changes
            </h3>
            <p style={{ fontSize: '13.5px', color: '#6B5E63', lineHeight: 1.6, margin: '0 0 22px' }}>
              You have unsaved layout changes. Loading another hall will discard those changes. Do you want to continue?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={cancelHallSwitch}
                style={{
                  flex: 1, padding: '11px', borderRadius: '50px', border: '1.5px solid #E8E2E5',
                  background: 'white', color: '#6B5E63', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmHallSwitch}
                style={{
                  flex: 1, padding: '11px', borderRadius: '50px', border: 'none',
                  background: `linear-gradient(135deg,${COLORS.primary},#9A2259)`, color: 'white',
                  fontWeight: 700, fontSize: '13.5px', cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(180,43,106,0.3)', transition: 'all 0.15s',
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clear Layout confirmation modal (replaces window.confirm) ── */}
      {clearConfirmOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setClearConfirmOpen(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(27,10,18,0.6)',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
            animation: 'modalBackdropFade 0.18s ease',
          }}
        >
          <div style={{
            background: 'white', borderRadius: 18, width: '100%', maxWidth: 380,
            boxShadow: '0 24px 60px rgba(27,10,18,0.2)',
            animation: 'modalScaleIn 0.2s cubic-bezier(0.34,1.4,0.64,1)', overflow: 'hidden',
          }}>
            <div style={{ background: '#FEF2F2', padding: '20px 22px 16px', textAlign: 'center', borderBottom: '1px solid #FCA5A5' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FEE2E2', border: '2px solid #FCA5A5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <FiTrash2 size={20} color="#DC2626" />
              </div>
              <h3 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 800, fontSize: 17, color: '#1B0A12', margin: '0 0 6px' }}>Clear Layout</h3>
              <p style={{ fontSize: 13, color: '#6B5E63', margin: 0 }}>
                Remove <strong style={{ color: '#DC2626' }}>all {benches.size} bench{benches.size === 1 ? '' : 'es'}</strong> from this layout? This cannot be undone until you save.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '16px 22px' }}>
              <button
                onClick={() => setClearConfirmOpen(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 50, border: '1.5px solid #E8E2E5', background: 'white', color: '#6B5E63', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmClearAll}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 50, border: 'none', background: '#DC2626', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}
              >
                <FiTrash2 size={13} /> Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Hall confirmation modal ── */}
      {deleteHallConfirmOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setDeleteHallConfirmOpen(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(27,10,18,0.6)',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
            animation: 'modalBackdropFade 0.18s ease',
          }}
        >
          <div style={{
            background: 'white', borderRadius: 18, width: '100%', maxWidth: 380,
            boxShadow: '0 24px 60px rgba(27,10,18,0.2)',
            animation: 'modalScaleIn 0.2s cubic-bezier(0.34,1.4,0.64,1)', overflow: 'hidden',
          }}>
            <div style={{ background: '#FEF2F2', padding: '20px 22px 16px', textAlign: 'center', borderBottom: '1px solid #FCA5A5' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FEE2E2', border: '2px solid #FCA5A5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <FiTrash2 size={20} color="#DC2626" />
              </div>
              <h3 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 800, fontSize: 17, color: '#1B0A12', margin: '0 0 6px' }}>Delete Hall</h3>
              <p style={{ fontSize: 13, color: '#6B5E63', margin: 0 }}>
                Delete <strong style={{ color: '#DC2626' }}>"{selectedHall}"</strong> and its saved bench layout? This cannot be undone. Any past allocation that used this hall will keep showing its name, but it will no longer be selectable for new plans.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, padding: '16px 22px' }}>
              <button
                onClick={() => setDeleteHallConfirmOpen(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 50, border: '1.5px solid #E8E2E5', background: 'white', color: '#6B5E63', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteHall}
                disabled={deletingHall}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 50, border: 'none', background: '#DC2626', color: 'white', fontWeight: 700, fontSize: 13, cursor: deletingHall ? 'default' : 'pointer', opacity: deletingHall ? 0.7 : 1, boxShadow: '0 4px 12px rgba(220,38,38,0.3)' }}
              >
                {deletingHall ? 'Deleting...' : <><FiTrash2 size={13} /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes benchPlace {
          0% { transform: translateY(-12px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeDown {
          from { opacity: 0; transform: translate3d(-50%, -6px, 0); }
          to { opacity: 1; transform: translate3d(-50%, 0, 0); }
        }
        @keyframes tooltipFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalBackdropFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalScaleIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </m.div>
  );
};

/* ── Shared tiny button style for +/- controls ── */
const controlBtn = {
  width: 28, height: 28, borderRadius: '8px',
  border: '1.5px solid #E8E2E5', background: 'white',
  cursor: 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'center', color: '#6B5E63', padding: 0,
  transition: 'all 0.12s',
};

export default HallLayoutDesigner;
