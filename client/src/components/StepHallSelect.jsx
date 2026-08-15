import { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import { FiCheck, FiAlertTriangle, FiXCircle, FiUsers, FiHome, FiLayers } from 'react-icons/fi';

const StepHallSelect = ({ formData, setFormData, totalStudents }) => {
  const [allHalls, setAllHalls] = useState([]);
  const [layoutSet, setLayoutSet] = useState(new Set()); // hall names that have saved layouts
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/halls'),
      api.get('/hall-layouts'),
    ]).then(([hallRes, layoutRes]) => {
      setAllHalls(hallRes.data);
      setLayoutSet(new Set((layoutRes.data || []).map(l => l.hallName)));
    }).catch(() => toast.error('Failed to load halls'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggleHall = (hallName) => {
    const index = formData.halls.findIndex(h => h.hallName === hallName);
    if (index >= 0) {
      setFormData(prev => ({ ...prev, halls: prev.halls.filter(h => h.hallName !== hallName) }));
    } else {
      setFormData(prev => ({ ...prev, halls: [...prev.halls, { hallName, capacity: '' }] }));
    }
  };

  const handleCapacityChange = (hallName, value) => {
    setFormData(prev => ({
      ...prev,
      halls: prev.halls.map(h =>
        h.hallName === hallName ? { ...h, capacity: value ? parseInt(value) : '' } : h
      )
    }));
  };

  const totalCapacity = formData.halls.reduce((acc, curr) => acc + (parseInt(curr.capacity) || 0), 0);
  const isSufficient = totalCapacity >= totalStudents && totalCapacity > 0;
  const isExact = totalCapacity === totalStudents;
  const isOver = totalCapacity > totalStudents;
  const isShort = totalCapacity > 0 && totalCapacity < totalStudents;
  const diff = Math.abs(totalCapacity - totalStudents);

  const statusConfig = (() => {
    if (!totalCapacity) return { bg: '#F8F5F7', color: '#9B8F94', border: '#E8E2E5', label: 'Select halls below', icon: null };
    if (isExact) return { bg: '#DCFCE7', color: '#15803D', border: '#86EFAC', label: 'Perfect match!', icon: <FiCheck size={13} /> };
    if (isOver) return { bg: '#FEF9C3', color: '#A16207', border: '#FDE047', label: `+${diff} extra seats`, icon: <FiAlertTriangle size={13} /> };
    return { bg: '#FEE2E2', color: '#B91C1C', border: '#FCA5A5', label: `${diff} seats short`, icon: <FiXCircle size={13} /> };
  })();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
        <div className="spinner-border" style={{ color: '#B42B6A' }} role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="step-content hall-select-panel">

      {/* ── Capacity Status Banner — sticky so Students/Capacity/Select
           status stays visible while scrolling through the hall list ── */}
      <div className="capacity-banner capacity-banner-sticky" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '0',
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(16px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
        border: '1.5px solid #E8E2E5',
        borderRadius: '20px',
        padding: '20px 28px',
        marginBottom: '24px',
        boxShadow: '0 2px 12px rgba(27,10,18,0.06)',
      }}>
        {/* Stats row (Students + Capacity) */}
        <div className="capacity-stats">
          {/* Students */}
          <div className="capacity-cell">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginBottom: '2px' }}>
              <FiUsers size={12} color="#9B8F94" />
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#9B8F94', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Students</span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#1B0A12', lineHeight: 1 }}>{totalStudents}</div>
          </div>

          <div className="capacity-divider" style={{ width: '1px', height: '40px', background: '#E8E2E5', flexShrink: 0 }} />

          {/* Capacity */}
          <div className="capacity-cell">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginBottom: '2px' }}>
              <FiHome size={12} color="#9B8F94" />
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#9B8F94', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Capacity</span>
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#B42B6A', lineHeight: 1 }}>{totalCapacity || '—'}</div>
          </div>
        </div>

        <div className="capacity-divider capacity-divider-pill" style={{ width: '1px', height: '40px', background: '#E8E2E5', flexShrink: 0 }} />

        {/* Status pill */}
        <div className="capacity-pill-wrap">
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            background: statusConfig.bg,
            color: statusConfig.color,
            border: `1px solid ${statusConfig.border}`,
            borderRadius: '50px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: '700',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}>
            {statusConfig.icon}
            {statusConfig.label}
          </div>
        </div>
      </div>

      {/* ── Halls Grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
      }} className="halls-grid">
        {allHalls.map(hall => {
          const isSelected = formData.halls.some(h => h.hallName === hall.hallName);
          const hallData = formData.halls.find(h => h.hallName === hall.hallName);

          return (
            <div
              key={hall._id}
              className="hall-card"
              onClick={(e) => { if (e.target.tagName !== 'INPUT') handleToggleHall(hall.hallName); }}
              style={{
                position: 'relative',
                background: isSelected
                  ? 'linear-gradient(135deg, #FDF2F7 0%, #FEF7FB 100%)'
                  : 'white',
                border: isSelected ? '2px solid #B42B6A' : '1.5px solid #E8E2E5',
                borderRadius: '16px',
                padding: '16px 14px',
                cursor: 'pointer',
                boxShadow: isSelected
                  ? '0 4px 16px rgba(180,43,106,0.15)'
                  : '0 1px 4px rgba(27,10,18,0.05)',
                transform: isSelected ? 'translateY(-2px)' : 'none',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                minHeight: '110px',
              }}
            >
              {/* Selection order number badge */}
              {isSelected && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  minWidth: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #B42B6A 0%, #9A2259 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(180,43,106,0.45)',
                  animation: 'badgePop 0.22s cubic-bezier(0.34,1.56,0.64,1)',
                  padding: '0 4px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: 'white', lineHeight: 1 }}>
                    {formData.halls.findIndex(h => h.hallName === hall.hallName) + 1}
                  </span>
                </div>
              )}

              {/* Hall icon */}
              <div className="hall-card-icon" style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: isSelected ? 'rgba(180,43,106,0.1)' : '#F8F5F7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <FiHome size={18} color={isSelected ? '#B42B6A' : '#9B8F94'} />
              </div>

              {/* Hall name */}
              <span className="hall-card-name" style={{
                fontWeight: '700',
                fontSize: '14px',
                color: isSelected ? '#B42B6A' : '#1B0A12',
                textAlign: 'center',
                lineHeight: 1.2,
              }}>
                {hall.hallName}
              </span>

              {/* Layout status badge */}
              <div style={{ fontSize: '9px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px',
                color: layoutSet.has(hall.hallName) ? '#15803D' : '#9B8F94',
                background: layoutSet.has(hall.hallName) ? '#DCFCE7' : '#F3F4F6',
                border: `1px solid ${layoutSet.has(hall.hallName) ? '#86EFAC' : '#E5E7EB'}`,
                borderRadius: '50px', padding: '2px 7px',
              }}>
                <FiLayers size={8} />
                {layoutSet.has(hall.hallName) ? 'Layout Ready' : 'No Layout'}
              </div>

              {/* Capacity input — shown only when selected */}
              {isSelected && (
                <div
                  style={{
                    width: '100%',
                    background: 'white',
                    border: '1.5px solid rgba(180,43,106,0.25)',
                    borderRadius: '10px',
                    padding: '6px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <input
                    type="number"
                    value={hallData?.capacity || ''}
                    onChange={e => handleCapacityChange(hall.hallName, e.target.value)}
                    onClick={e => e.stopPropagation()}
                    placeholder="0"
                    min="1"
                    style={{
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      textAlign: 'center',
                      fontWeight: '800',
                      fontSize: '20px',
                      color: '#B42B6A',
                      background: 'transparent',
                      lineHeight: 1,
                      padding: 0,
                    }}
                  />
                  <span style={{
                    fontSize: '9px',
                    fontWeight: '700',
                    color: '#9B8F94',
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    marginTop: '2px',
                  }}>
                    Capacity
                  </span>
                </div>
              )}

              {/* Placeholder when not selected */}
              {!isSelected && (
                <span style={{ fontSize: '11px', color: '#C9BFC5', fontWeight: '500' }}>
                  Tap to select
                </span>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes badgePop {
          0%   { transform: scale(0); opacity: 0; }
          70%  { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .capacity-stats {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1 1 auto;
        }
        .capacity-cell {
          text-align: center;
          padding: 0 26px;
          flex: 1 1 0;
          min-width: 0;
        }
        .capacity-pill-wrap {
          padding: 0 26px;
          display: flex;
          justify-content: center;
          min-width: 0;
        }

        /* ── Sticky summary: stays visible below the sticky navbar while
           scrolling through the hall list, on every breakpoint. The top
           offset matches the navbar's own height at each tier so the
           banner attaches directly beneath it without a jump. ── */
        .capacity-banner-sticky {
          position: sticky;
          top: 84px;
          z-index: 50;
        }
        @media (max-width: 991px) {
          .capacity-banner-sticky { top: 74px; }
        }
        @media (max-width: 480px) {
          .capacity-banner-sticky { top: 66px; }
        }

        /* ── Widen the hall-select panel beyond the shared 860px wizard
           cap, only where there's actual slack to grow into (≥993px —
           below that, .compact-view already stretches to 100% and any
           negative margin here would cause horizontal scroll). ── */
        @media (min-width: 993px) {
          .hall-select-panel {
            width: calc(100% + 74px);
            margin-left: -37px;
            margin-right: -37px;
            padding: 30px 38px 34px !important;
          }
        }
        /* Tablet/laptop — no extra width slack, but still give the
           card generous internal padding so cards don't hug the edges. */
        @media (min-width: 601px) and (max-width: 992px) {
          .hall-select-panel { padding: 22px 26px 26px !important; }
        }
        @media (max-width: 768px) {
          .halls-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
          }
          .hall-card {
            padding: 12px 10px !important;
            min-height: 96px !important;
            gap: 7px !important;
          }
          .hall-card-icon { width: 32px !important; height: 32px !important; }
          .hall-card-icon svg { width: 15px !important; height: 15px !important; }
          .hall-card-name { font-size: 12.5px !important; }
          .capacity-banner {
            padding: 12px 12px !important;
            gap: 10px 0 !important;
          }
          .capacity-stats {
            width: 100%;
            order: 1;
          }
          .capacity-cell {
            padding: 0 10px;
          }
          .capacity-divider-pill {
            display: none !important;
          }
          .capacity-pill-wrap {
            width: 100%;
            order: 2;
            padding: 8px 0 0;
            border-top: 1px solid #E8E2E5;
          }
        }
        @media (max-width: 480px) {
          .halls-grid {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
          .hall-card {
            padding: 10px 12px !important;
            min-height: 84px !important;
          }
          .capacity-cell {
            padding: 0 8px;
          }
        }
      `}</style>
    </div>
  );
};

export default StepHallSelect;
