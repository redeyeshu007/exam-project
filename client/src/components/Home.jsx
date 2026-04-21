import { useNavigate } from 'react-router-dom';
import { FiGrid, FiClipboard, FiArrowRight } from 'react-icons/fi';

const Home = () => {
  const navigate = useNavigate();

  const cardStyle = {
    background: 'white',
    borderRadius: '20px',
    border: '1.5px solid #E8E2E5',
    boxShadow: '0 4px 20px rgba(27,10,18,0.07)',
    padding: 'clamp(20px, 5vw, 36px) clamp(18px, 4vw, 32px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '16px',
    cursor: 'default',
    transition: 'box-shadow 0.22s ease, border-color 0.22s ease, transform 0.22s ease',
    flex: '1 1 280px',
    minWidth: '0',
    maxWidth: '480px',
    width: '100%',
  };

  const iconWrap = (bg) => ({
    width: '56px', height: '56px', borderRadius: '16px',
    background: bg,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: '4px',
  });

  const primaryBtn = {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '11px 24px', borderRadius: '50px', border: 'none',
    background: 'linear-gradient(135deg,#B42B6A 0%,#9A2259 100%)',
    color: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(180,43,106,0.30)',
    transition: 'all 0.2s',
    marginTop: 'auto',
  };

  const outlineBtn = {
    display: 'inline-flex', alignItems: 'center', gap: '8px',
    padding: '11px 24px', borderRadius: '50px',
    border: '2px solid #B42B6A',
    background: 'white',
    color: '#B42B6A', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
    transition: 'all 0.2s',
    marginTop: 'auto',
  };

  return (
    <div className="px-3 px-lg-4 py-4 page-enter">

      {/* Page header */}
      <div className="mb-5">
        <h2 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: '800', fontSize: 'clamp(20px, 5vw, 28px)', color: '#1B0A12',
          marginBottom: '8px',
        }}>
          Welcome to E-Exam Hall System
        </h2>
        <p style={{ color: '#9B8F94', fontSize: '15px', margin: 0 }}>
          PSNA College of Engineering and Technology &bull; Dept. of CSE
        </p>
      </div>

      {/* Feature cards */}
      <div className="home-feature-cards" style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'stretch' }}>

        {/* Card 1 — E-Exam Hall Generation */}
        <div
          style={cardStyle}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = '0 8px 36px rgba(180,43,106,0.13)';
            e.currentTarget.style.borderColor = 'rgba(180,43,106,0.30)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(27,10,18,0.07)';
            e.currentTarget.style.borderColor = '#E8E2E5';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={iconWrap('#FDF2F7')}>
            <FiGrid size={26} color="#B42B6A" />
          </div>

          <div>
            <h3 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: '800', fontSize: '20px', color: '#1B0A12', marginBottom: '8px',
            }}>
              E-Exam Hall Generation
            </h3>
            <p style={{ color: '#6B5E63', fontSize: '14px', lineHeight: '1.65', margin: 0 }}>
              Allocate students to exam halls automatically. Configure exam details,
              sections, and hall capacities — the system assigns seats and generates
              a ready-to-print hall plan.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#B42B6A', background: '#FDF2F7', padding: '4px 12px', borderRadius: '50px', border: '1px solid rgba(180,43,106,0.18)' }}>
              Standard Allocation
            </span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#B42B6A', background: '#FDF2F7', padding: '4px 12px', borderRadius: '50px', border: '1px solid rgba(180,43,106,0.18)' }}>
              Elective Seating
            </span>
          </div>

          <button
            style={primaryBtn}
            onClick={() => navigate('/allocate')}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Go to Hall Allocation <FiArrowRight size={15} />
          </button>
        </div>

        {/* Card 2 — Attendance Sheet Generation */}
        <div
          style={cardStyle}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = '0 8px 36px rgba(180,43,106,0.13)';
            e.currentTarget.style.borderColor = 'rgba(180,43,106,0.30)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(27,10,18,0.07)';
            e.currentTarget.style.borderColor = '#E8E2E5';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={iconWrap('#FDF2F7')}>
            <FiClipboard size={26} color="#B42B6A" />
          </div>

          <div>
            <h3 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: '800', fontSize: '20px', color: '#1B0A12', marginBottom: '8px',
            }}>
              Attendance Sheet Generation
            </h3>
            <p style={{ color: '#6B5E63', fontSize: '14px', lineHeight: '1.65', margin: 0 }}>
              Generate per-hall attendance sheets from a saved exam allocation.
              Sheets follow the official PSNA format with student register numbers,
              names, and exam date columns ready for invigilator sign-off.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#B42B6A', background: '#FDF2F7', padding: '4px 12px', borderRadius: '50px', border: '1px solid rgba(180,43,106,0.18)' }}>
              PSNA Format
            </span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#B42B6A', background: '#FDF2F7', padding: '4px 12px', borderRadius: '50px', border: '1px solid rgba(180,43,106,0.18)' }}>
              Per-Hall Pages
            </span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#B42B6A', background: '#FDF2F7', padding: '4px 12px', borderRadius: '50px', border: '1px solid rgba(180,43,106,0.18)' }}>
              Print Ready
            </span>
          </div>

          <button
            style={outlineBtn}
            onClick={() => navigate('/attendance')}
            onMouseEnter={e => { e.currentTarget.style.background = '#FDF2F7'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
          >
            Go to Attendance Sheets <FiArrowRight size={15} />
          </button>
        </div>

      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #E8E2E5', margin: '48px 0 32px' }} />

      {/* Quick links */}
      <div>
        <p style={{ fontSize: '12px', fontWeight: '700', color: '#9B8F94', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '14px' }}>
          Quick Access
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { label: 'New Allocation', path: '/allocate' },
            { label: 'Allocation History', path: '/history' },
            { label: 'Attendance Sheets', path: '/attendance' },
          ].map(({ label, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={{
                padding: '8px 20px', borderRadius: '50px',
                border: '1.5px solid #E8E2E5', background: 'white',
                color: '#6B5E63', fontWeight: '600', fontSize: '13px', cursor: 'pointer',
                transition: 'all 0.18s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#B42B6A'; e.currentTarget.style.color = '#B42B6A'; e.currentTarget.style.background = '#FDF2F7'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8E2E5'; e.currentTarget.style.color = '#6B5E63'; e.currentTarget.style.background = 'white'; }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};

export default Home;
