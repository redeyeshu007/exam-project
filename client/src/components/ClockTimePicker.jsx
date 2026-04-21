import { useState, useEffect } from 'react';

const pad = (n) => String(n).padStart(2, '0');

const TimeSpinner = ({ value, min, max, step = 1, onChange, label }) => {
  const inc = () => onChange(value + step > max ? min : value + step);
  const dec = () => onChange(value - step < min ? max : value - step);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
      <button
        type="button"
        onClick={inc}
        style={{
          background: 'none', border: 'none', color: '#B42B6A',
          fontSize: '16px', cursor: 'pointer', padding: '4px 10px',
          lineHeight: 1, borderRadius: '6px', transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(180,43,106,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >▲</button>

      <div style={{
        background: 'linear-gradient(135deg, #FDF2F7 0%, #fff 100%)',
        color: '#B42B6A',
        fontFamily: "'JetBrains Mono', Consolas, monospace",
        fontSize: '26px',
        fontWeight: '700',
        padding: '8px 14px',
        borderRadius: '10px',
        minWidth: '56px',
        textAlign: 'center',
        border: '1.5px solid rgba(180,43,106,0.2)',
        boxShadow: '0 2px 8px rgba(180,43,106,0.08), inset 0 1px 2px rgba(255,255,255,0.8)',
        letterSpacing: '2px',
        userSelect: 'none',
        transition: 'all 0.15s',
      }}>
        {pad(value)}
      </div>

      <button
        type="button"
        onClick={dec}
        style={{
          background: 'none', border: 'none', color: '#B42B6A',
          fontSize: '16px', cursor: 'pointer', padding: '4px 10px',
          lineHeight: 1, borderRadius: '6px', transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(180,43,106,0.08)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >▼</button>

      <span style={{
        fontSize: '9px', fontWeight: '700', color: '#9B8F94',
        letterSpacing: '1.2px', textTransform: 'uppercase', marginTop: '2px',
      }}>{label}</span>
    </div>
  );
};

const PeriodToggle = ({ value, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginLeft: '4px', marginTop: '-14px' }}>
    {['AM', 'PM'].map(p => (
      <button
        key={p}
        type="button"
        onClick={() => onChange(p)}
        style={{
          padding: '5px 9px',
          borderRadius: '8px',
          border: value === p ? '2px solid #B42B6A' : '2px solid #E8E2E5',
          background: value === p
            ? 'linear-gradient(135deg, #B42B6A 0%, #9A2259 100%)'
            : 'white',
          color: value === p ? 'white' : '#9B8F94',
          fontWeight: '700',
          fontSize: '10px',
          cursor: 'pointer',
          transition: 'all 0.18s',
          lineHeight: 1,
          letterSpacing: '0.5px',
          boxShadow: value === p ? '0 2px 6px rgba(180,43,106,0.3)' : 'none',
        }}
      >
        {p}
      </button>
    ))}
  </div>
);

const ClockTimePicker = ({ session, value, onChange }) => {
  const getDefaults = () => {
    if (session === 'FN') return { sh: 9, sm: 30, sp: 'AM', eh: 11, em: 30, ep: 'AM' };
    return { sh: 2, sm: 30, sp: 'PM', eh: 4, em: 30, ep: 'PM' };
  };

  const parseValue = (v) => {
    if (!v) return getDefaults();
    const m = v.match(/(\d+)[.:.](\d+)\s*(AM|PM)\s*-\s*(\d+)[.:.](\d+)\s*(AM|PM)/i);
    if (!m) return getDefaults();
    return {
      sh: +m[1], sm: +m[2], sp: m[3].toUpperCase(),
      eh: +m[4], em: +m[5], ep: m[6].toUpperCase(),
    };
  };

  const init = parseValue(value);
  const [sh, setSh] = useState(init.sh);
  const [sm, setSm] = useState(init.sm);
  const [sp, setSp] = useState(init.sp);
  const [eh, setEh] = useState(init.eh);
  const [em, setEm] = useState(init.em);
  const [ep, setEp] = useState(init.ep);

  useEffect(() => {
    const d = getDefaults();
    setSh(d.sh); setSm(d.sm); setSp(d.sp);
    setEh(d.eh); setEm(d.em); setEp(d.ep);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    onChange(`${session} & ${pad(sh)}.${pad(sm)} ${sp} - ${pad(eh)}.${pad(em)} ${ep}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sh, sm, sp, eh, em, ep, session]);

  const clockBox = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 18px',
    background: 'white',
    borderRadius: '14px',
    border: '1.5px solid #E8E2E5',
    boxShadow: '0 2px 12px rgba(180,43,106,0.06)',
    justifyContent: 'center',
    width: '100%',
  };

  const colonStyle = {
    fontSize: '26px', fontWeight: '700', color: '#B42B6A',
    fontFamily: "'JetBrains Mono', Consolas, monospace",
    marginTop: '-14px', opacity: 0.4, userSelect: 'none',
  };

  const sectionStyle = {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1,
  };

  const sectionLabel = {
    fontSize: '10px', fontWeight: '700', color: '#9B8F94',
    letterSpacing: '1.5px', textTransform: 'uppercase',
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #FDF2F7 0%, #fff8fb 100%)',
      borderRadius: '16px',
      padding: '18px 16px 14px',
      border: '1.5px solid rgba(180,43,106,0.15)',
      boxShadow: '0 4px 16px rgba(180,43,106,0.06)',
    }}>
      {/* Live preview strip */}
      <div style={{
        textAlign: 'center',
        marginBottom: '14px',
        fontFamily: "'JetBrains Mono', Consolas, monospace",
        fontSize: '13px',
        fontWeight: '700',
        color: '#B42B6A',
        background: 'white',
        padding: '6px 16px',
        borderRadius: '20px',
        border: '1px solid rgba(180,43,106,0.15)',
        letterSpacing: '0.5px',
        boxShadow: '0 1px 4px rgba(180,43,106,0.08)',
      }}>
        🕐 {session} &nbsp;&amp;&nbsp; {pad(sh)}.{pad(sm)} {sp} &nbsp;—&nbsp; {pad(eh)}.{pad(em)} {ep}
      </div>

      <div className="clock-pickers-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Start time */}
        <div style={sectionStyle}>
          <span style={sectionLabel}>Start Time</span>
          <div style={clockBox}>
            <TimeSpinner value={sh} min={1} max={12} onChange={setSh} label="HR" />
            <div style={colonStyle}>:</div>
            <TimeSpinner value={sm} min={0} max={55} step={5} onChange={setSm} label="MIN" />
            <PeriodToggle value={sp} onChange={setSp} />
          </div>
        </div>

        {/* Arrow */}
        <div className="clock-arrow-divider" style={{ paddingTop: '18px' }}>
          <span style={{ fontSize: '18px', color: '#D4CDD0', fontWeight: 'bold' }}>→</span>
        </div>

        {/* End time */}
        <div style={sectionStyle}>
          <span style={sectionLabel}>End Time</span>
          <div style={clockBox}>
            <TimeSpinner value={eh} min={1} max={12} onChange={setEh} label="HR" />
            <div style={colonStyle}>:</div>
            <TimeSpinner value={em} min={0} max={55} step={5} onChange={setEm} label="MIN" />
            <PeriodToggle value={ep} onChange={setEp} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClockTimePicker;
