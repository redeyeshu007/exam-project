import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiAlertTriangle, FiCheckCircle, FiGrid, FiInfo, FiRefreshCw, FiLayers, FiPrinter, FiRotateCcw, FiArrowLeft } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../services/api';

const YEAR_ORDER = ['I', 'II', 'III', 'IV'];

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function datesOverlap(a, b) {
  const aFrom = new Date(a.fromDate);
  const aTo = new Date(a.toDate);
  const bFrom = new Date(b.fromDate);
  const bTo = new Date(b.toDate);
  return aFrom <= bTo && bFrom <= aTo;
}

function getHallNames(alloc) {
  return (alloc.hallAllocations || []).map(ha => ha.hallName);
}

// For each allocation, find any other allocations that share ≥1 hall, the
// same session, and overlapping dates — these are the ones that will be
// seated together in one combined run. Returned as a map of
// allocationId -> [{ id, examName, year }] so each row can show a small
// "shares with" badge instead of a separate group-bundling UI.
function buildMatchMap(allocations) {
  const matches = {};
  for (let i = 0; i < allocations.length; i++) {
    for (let j = i + 1; j < allocations.length; j++) {
      const a = allocations[i];
      const b = allocations[j];

      const sharedHalls = getHallNames(a).filter(h => getHallNames(b).includes(h));
      const sameSession = a.session && b.session && a.session === b.session;
      const overlap = datesOverlap(a, b);

      // Same rule as before: shared hall + overlapping dates + matching
      // session — different sessions (e.g. FN vs AN) don't actually clash.
      if (sharedHalls.length > 0 && overlap && sameSession) {
        (matches[a._id] ??= []).push({ id: b._id, examName: b.examName, year: b.year });
        (matches[b._id] ??= []).push({ id: a._id, examName: a.examName, year: a.year });
      }
    }
  }
  return matches;
}

const SeatingAllotment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const preSelectId = location.state?.preSelectId || null;

  const [allocations, setAllocations] = useState([]);
  const [layouts, setLayouts] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [groupedConflicts, setGroupedConflicts] = useState([]); // [{hallName, allocations: [...]}]
  const [successData, setSuccessData] = useState(null); // set after generation succeeds

  // Responsive mobile states
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [activeMobileTab, setActiveMobileTab] = useState('list'); // 'list' | 'summary'

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/allocations'),
      api.get('/hall-layouts'),
    ]).then(([allocRes, layoutRes]) => {
      setAllocations(allocRes.data);
      const lmap = {};
      layoutRes.data.forEach(l => { lmap[l.hallName] = l; });
      setLayouts(lmap);
      // Auto-select allocation if navigated from StepResult
      if (preSelectId) {
        setSelectedIds([preSelectId]);
        navigate(location.pathname, { replace: true, state: {} }); // clear state
      }
    }).catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  // Detect same-date, same-hall conflicts whenever selection changes
  useEffect(() => {
    if (selectedIds.length === 0) { setGroupedConflicts([]); return; }

    const selected = allocations.filter(a => selectedIds.includes(a._id));

    // For each hall, gather which allocations share that hall AND have overlapping dates
    const hallMap = {}; // hallName → [{alloc, year}]

    for (let i = 0; i < selected.length; i++) {
      const a = selected[i];
      getHallNames(a).forEach(hn => {
        if (!hallMap[hn]) hallMap[hn] = [];
        hallMap[hn].push(a);
      });
    }

    // Build conflict groups: halls used by 2+ allocations with overlapping dates
    const conflicts = [];
    Object.entries(hallMap).forEach(([hallName, allocsForHall]) => {
      conflicts.push({
        hallName,
        allocations: allocsForHall,
        mixed: allocsForHall.length > 1,
      });
    });

    setGroupedConflicts(conflicts);
  }, [selectedIds, allocations]);

  const toggleId = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const missingLayouts = [...new Set(
    groupedConflicts.map(g => g.hallName).filter(hn => !layouts[hn])
  )];

  const handleGenerate = async () => {
    if (selectedIds.length === 0) { toast.warn('Select at least one allocation'); return; }
    setGenerating(true);
    try {
      const res = await api.post('/allocations/seating', { allocationIds: selectedIds });
      if (res.data.warnings && res.data.warnings.length > 0) {
        res.data.warnings.forEach(w => toast.warn(w, { autoClose: 6000 }));
      }
      const doneAllocs = allocations.filter(a => selectedIds.includes(a._id));
      setSuccessData({ allocations: doneAllocs, hallsProcessed: res.data.hallsProcessed });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to generate seating');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="px-3 px-lg-4 py-4">
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9B8F94' }}>Loading allocations...</div>
      </div>
    );
  }

  // ── Success Screen ──────────────────────────────────────────────────────────
  if (successData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px' }}>
          <div className="page-enter" style={{ maxWidth: '680px', margin: '0 auto' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 50, border: '1.5px solid #E8E2E5', background: 'white', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#6B5E63', marginBottom: 20, transition: 'all 0.15s' }}
        >
          <FiArrowLeft size={13} /> Back
        </button>
        {/* Banner */}
        <div style={{
          textAlign: 'center', padding: '36px 24px 28px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #FDF2F7 0%, #FEF7FB 100%)',
          border: '1.5px solid rgba(180,43,106,0.15)',
          marginBottom: '24px',
        }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #B42B6A 0%, #9A2259 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 28px rgba(180,43,106,0.3)',
          }}>
            <FiCheckCircle size={32} color="white" strokeWidth={2.5} />
          </div>
          <h3 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(20px,4vw,26px)', fontWeight: '800',
            color: '#1B0A12', margin: '0 0 8px',
          }}>
            Seating Generated Successfully!
          </h3>
          <p style={{ color: '#9B8F94', fontSize: '13px', margin: 0 }}>
            Bench-level seating has been allocated for {successData.hallsProcessed} hall{successData.hallsProcessed !== 1 ? 's' : ''}.
            Print or view the seat chart for each allocation below.
          </p>
        </div>

        {/* Per-allocation cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {successData.allocations.map((alloc, idx) => {
            const halls = getHallNames(alloc);
            const totalStudents = alloc.totalStrength || '?';
            return (
              <div key={alloc._id} className="card-interactive card-enter" style={{
                background: 'white', borderRadius: '16px',
                border: '1.5px solid #E8E2E5',
                padding: '16px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap',
                boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                animationDelay: `${idx * 0.06}s`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '800', fontSize: '15px', color: '#1B0A12', marginBottom: '4px' }}>
                    {alloc.examName || 'Untitled Exam'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B5E63', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ background: '#F3F4F6', padding: '2px 9px', borderRadius: '50px', fontWeight: '700', fontSize: '11px' }}>
                      {alloc.year} Year
                    </span>
                    <span>{alloc.yearSemester}</span>
                    <span style={{ color: '#9B8F94' }}>{totalStudents} students</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#9B8F94', marginTop: '4px' }}>
                    Halls: {halls.join(', ') || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    onClick={() => navigate(`/seat-chart/${alloc._id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '9px 18px', borderRadius: '50px', border: 'none',
                      background: 'linear-gradient(135deg,#B42B6A,#9A2259)',
                      color: 'white', fontWeight: '700', fontSize: '13px',
                      cursor: 'pointer', boxShadow: '0 3px 10px rgba(180,43,106,0.25)',
                    }}
                  >
                    <FiPrinter size={13} /> View / Print
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Generate another */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => { setSuccessData(null); setSelectedIds([]); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '10px 24px', borderRadius: '50px',
              border: '1.5px solid #E8E2E5', background: 'white',
              color: '#6B5E63', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
            }}
          >
            <FiRotateCcw size={13} /> Generate Another
          </button>
        </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'transparent',
      minHeight: '100vh',
    }}>

      {/* ── Page header — no card, blends straight into the page ── */}
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        padding: '24px 16px 4px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
          <h2 style={{
            fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 800,
            fontSize: 'clamp(20px,3.2vw,28px)', color: '#1B0A12', margin: 0,
            letterSpacing: '0.1px',
          }}>
            Seating Allotment
          </h2>
          {selectedIds.length > 0 && (
            <span style={{
              background: 'rgba(180,43,106,0.10)', color: '#B42B6A',
              border: '1px solid rgba(180,43,106,0.25)',
              fontSize: 11, fontWeight: 800, padding: '3px 11px', borderRadius: 50, flexShrink: 0,
            }}>
              {selectedIds.length} selected
            </span>
          )}
        </div>

        {/* Desktop generate button in header */}
        {!isMobile && (
          <button
            className="seating-generate-btn"
            onClick={handleGenerate}
            disabled={generating || selectedIds.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 24px', borderRadius: 50, border: 'none',
              background: generating || selectedIds.length === 0
                ? '#E8E2E5'
                : 'linear-gradient(135deg,#C2185B,#E91E63)',
              color: generating || selectedIds.length === 0 ? '#9B8F94' : 'white',
              fontWeight: 700, fontSize: 13,
              cursor: generating || selectedIds.length === 0 ? 'default' : 'pointer',
              boxShadow: generating || selectedIds.length === 0 ? 'none' : '0 6px 18px rgba(194,24,91,0.28)',
              transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {generating
              ? <><FiRefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Generating…</>
              : <><FiLayers size={13} /> Generate Seating</>
            }
          </button>
        )}
      </div>

      {/* ── Page body ── */}
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        padding: '14px 16px',
        paddingBottom: isMobile && selectedIds.length > 0 ? 88 : 32,
      }}>

        {/* Main layout: list (left) + summary (right) */}
        <div className="seating-main-row" style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>

          {/* ── Allocation list ── */}
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9B8F94', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 10 }}>
              Select Allocations
            </div>

            {allocations.length === 0 ? (
              <div style={{
                padding: '28px 20px', textAlign: 'center', borderRadius: 18,
                background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                border: '1.5px dashed rgba(27,10,18,0.14)', color: '#9B8F94', fontSize: 13,
              }}>
                No allocations found — create one via <strong>New Allocation</strong>.
              </div>
            ) : (
              <div className="seating-alloc-list" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {(() => {
                  const matchMap = buildMatchMap(allocations);
                  return allocations.map(alloc => {
                  const isSelected = selectedIds.includes(alloc._id);
                  const matches = matchMap[alloc._id] || [];
                  return (
                    <div
                      key={alloc._id}
                      onClick={() => toggleId(alloc._id)}
                      style={{
                        padding: '14px 18px', borderRadius: 16, cursor: 'pointer',
                        border: `1.5px solid ${isSelected ? 'rgba(180,43,106,0.35)' : 'rgba(27,10,18,0.08)'}`,
                        background: isSelected ? 'rgba(253,242,247,0.6)' : 'rgba(255,255,255,0.42)',
                        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                        transition: 'border-color 0.25s, background 0.25s, box-shadow 0.25s',
                        boxShadow: isSelected ? '0 8px 24px rgba(180,43,106,0.10)' : '0 2px 10px rgba(27,10,18,0.03)',
                        display: 'flex', alignItems: 'center', gap: 12,
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      {/* Checkbox */}
                      <div style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                        border: `2px solid ${isSelected ? '#B42B6A' : '#D1D5DB'}`,
                        background: isSelected ? '#B42B6A' : 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}>
                        {isSelected && <span style={{ color: 'white', fontSize: 11, fontWeight: 800 }}>✓</span>}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                          <span style={{ fontWeight: 800, fontSize: 14, color: '#1B0A12', wordBreak: 'break-word' }}>
                            {alloc.examName || 'Untitled Exam'}
                          </span>
                          <span style={{
                            background: isSelected ? 'rgba(180,43,106,0.12)' : '#F3F4F6',
                            color: isSelected ? '#B42B6A' : '#6B5E63',
                            padding: '1px 8px', borderRadius: 50, fontWeight: 700, fontSize: 11, flexShrink: 0,
                          }}>
                            {alloc.year} Year
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: '#6B5E63', alignItems: 'center' }}>
                          <span>{alloc.yearSemester}</span>
                          <span style={{ color: '#D1D5DB' }}>·</span>
                          <span style={{ whiteSpace: 'nowrap' }}>
                            {formatDate(alloc.fromDate)}{alloc.toDate && alloc.fromDate !== alloc.toDate ? ` – ${formatDate(alloc.toDate)}` : ''}
                          </span>
                          <span style={{ color: '#D1D5DB' }}>·</span>
                          <span style={{ color: '#9B8F94' }}>{alloc.session}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#9B8F94', marginTop: 3 }}>
                          {getHallNames(alloc).join(', ') || '—'}&nbsp;&bull;&nbsp;{alloc.totalStrength || '?'} students
                        </div>
                        {matches.length > 0 && (
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                            {matches.map(m => (
                              <span
                                key={m.id}
                                onClick={(e) => { e.stopPropagation(); toggleId(m.id); }}
                                title="Same halls, session & dates — click to select it too"
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  background: 'rgba(180,43,106,0.08)', color: '#B42B6A',
                                  border: '1px solid rgba(180,43,106,0.22)',
                                  padding: '2px 9px', borderRadius: 50, fontSize: 10, fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                <FiLayers size={9} /> Shares group with {m.year} Yr · {m.examName || 'Untitled Exam'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                  });
                })()}
              </div>
            )}
          </div>

          {/* ── Summary panel — one unified glass panel ── */}
          <div className="seating-summary-panel" style={{
            width: isMobile ? '100%' : 276, flexShrink: 0,
            position: isMobile ? 'static' : 'sticky', top: 68,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9B8F94', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 10 }}>
              Seating Summary
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.45)',
              backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
              borderRadius: 22,
              border: '1px solid rgba(194,24,91,0.25)',
              boxShadow: '0 20px 60px rgba(194,24,91,0.08)',
              padding: selectedIds.length === 0 ? '26px 18px' : '18px',
            }}>
              {selectedIds.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9B8F94', fontSize: 13 }}>
                  <FiGrid size={26} color="#D1D5DB" style={{ display: 'block', margin: '0 auto 8px' }} />
                  Select allocations to preview hall groups
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* Per-hall groups */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {groupedConflicts.map((group, gi) => (
                      <div key={group.hallName} style={{
                        paddingBottom: gi < groupedConflicts.length - 1 ? 12 : 0,
                        borderBottom: gi < groupedConflicts.length - 1 ? '1px solid rgba(27,10,18,0.07)' : 'none',
                      }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: '#1B0A12', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <FiGrid size={12} color="#B42B6A" />
                          {group.hallName}
                          {group.mixed && (
                            <span style={{ fontSize: 10, background: 'rgba(180,43,106,0.10)', color: '#B42B6A', fontWeight: 700, padding: '1px 7px', borderRadius: 50, border: '1px solid rgba(180,43,106,0.18)' }}>
                              Mixed
                            </span>
                          )}
                        </div>
                        {group.allocations.map(a => (
                          <div key={a._id} style={{ fontSize: 12, color: '#6B5E63', display: 'flex', justifyContent: 'space-between', paddingBottom: 2 }}>
                            <span style={{ fontWeight: 700 }}>{a.year} Yr · {a.yearSemester}</span>
                            <span style={{ color: '#9B8F94' }}>{a.totalStrength || '?'} stu.</span>
                          </div>
                        ))}
                        <div style={{ marginTop: 6, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {layouts[group.hallName] ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)',
                              padding: '3px 9px', borderRadius: 50,
                            }}>
                              <FiCheckCircle size={11} color="#16A34A" /><span style={{ color: '#16A34A', fontWeight: 700 }}>Layout ready · {layouts[group.hallName].totalSeats} seats</span>
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              background: 'rgba(255,200,80,0.12)', border: '1px solid rgba(255,180,60,0.30)',
                              padding: '3px 9px', borderRadius: 50,
                            }}>
                              <FiAlertTriangle size={11} color="#B45309" /><span style={{ color: '#B45309', fontWeight: 700 }}>No layout · sequential fallback</span>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Missing layout warning */}
                  {missingLayouts.length > 0 && (
                    <div
                      onClick={() => navigate(`/hall-designer?hall=${encodeURIComponent(missingLayouts[0])}`)}
                      style={{
                        padding: '10px 13px', background: 'rgba(255,200,80,0.12)', borderRadius: 12, border: '1px solid rgba(255,180,60,0.30)',
                        display: 'flex', gap: 7, cursor: 'pointer', transition: 'background-color 0.25s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,200,80,0.20)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,200,80,0.12)'}
                      title="Click to design layout for this hall"
                    >
                      <FiAlertTriangle size={13} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
                      <div style={{ fontSize: 11, color: '#92400E' }}>
                        <strong>{missingLayouts.join(', ')}</strong> — no layout. Click here to design.
                      </div>
                    </div>
                  )}

                  {/* Info note */}
                  <div style={{ padding: '10px 13px', background: 'rgba(70,120,255,0.10)', borderRadius: 12, border: '1px solid rgba(70,120,255,0.25)', display: 'flex', gap: 7 }}>
                    <FiInfo size={12} color="#3B5FE0" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 11, color: '#2A46B8', lineHeight: 1.4 }}>
                      Order: Year I→II→III→IV, then section A→B→C, then roll no.
                    </div>
                  </div>

                  {/* Desktop generate button (in summary panel) */}
                  {!isMobile && (
                    <button
                      className="seating-generate-btn"
                      onClick={handleGenerate}
                      disabled={generating}
                      style={{
                        width: '100%', padding: '12px', borderRadius: 50, border: 'none',
                        background: generating ? '#E8E2E5' : 'linear-gradient(135deg,#C2185B,#E91E63)',
                        color: generating ? '#9B8F94' : 'white',
                        fontWeight: 700, fontSize: 13, cursor: generating ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        boxShadow: generating ? 'none' : '0 6px 18px rgba(194,24,91,0.28)',
                        transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
                      }}
                    >
                      {generating
                        ? <><FiRefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Generating…</>
                        : <><FiLayers size={13} /> Generate Seating</>
                      }
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile sticky bottom generate button ── */}
      {isMobile && selectedIds.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          padding: '10px 16px 16px',
          background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
          borderTop: '1px solid rgba(27,10,18,0.08)',
          boxShadow: '0 -4px 20px rgba(27,10,18,0.10)',
        }}>
          <button
            className="seating-generate-btn"
            onClick={handleGenerate}
            disabled={generating}
            style={{
              width: '100%', padding: '13px', borderRadius: 50, border: 'none',
              background: generating ? '#E8E2E5' : 'linear-gradient(135deg,#C2185B,#E91E63)',
              color: generating ? '#9B8F94' : 'white',
              fontWeight: 800, fontSize: 14, cursor: generating ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: generating ? 'none' : '0 6px 22px rgba(194,24,91,0.35)',
              transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
            }}
          >
            {generating
              ? <><FiRefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> Generating…</>
              : <><FiLayers size={14} /> Generate for {selectedIds.length} Allocation{selectedIds.length !== 1 ? 's' : ''}</>
            }
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        .seating-generate-btn:not(:disabled):hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(194,24,91,0.38) !important;
        }
        .seating-generate-btn:not(:disabled):active {
          transform: scale(0.98);
        }

        .seating-toggle-btn:active { transform: scale(0.98) !important; }

        @media (max-width: 1024px) {
          .seating-main-row { flex-direction: column !important; }
          .seating-summary-panel { width: 100% !important; position: static !important; top: auto !important; }
        }

        @media (max-width: 600px) {
          .seating-toggle-btn { padding: 6px 12px !important; font-size: 10.5px !important; }
        }
      `}</style>
    </div>
  );
};

export default SeatingAllotment;
