import { FiMail, FiMapPin, FiCpu } from 'react-icons/fi';

const Footer = () => (
  <footer className="no-print" style={{
    background: 'white',
    borderTop: '1px solid #E8E2E5',
    padding: '14px 20px',
  }}>
    <div style={{
      maxWidth: '1100px',
      margin: '0 auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      flexWrap: 'wrap',
    }}>

      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <img src="/psna1logo.png" alt="PSNA" style={{ height: '26px', objectFit: 'contain', opacity: 0.8 }} />
        <div style={{ borderLeft: '1px solid #E8E2E5', paddingLeft: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#1B0A12', fontFamily: "'Playfair Display',Georgia,serif", lineHeight: 1.2 }}>
            E-Exam Hall Allocation
          </div>
          <div style={{ fontSize: '9px', color: '#B42B6A', fontWeight: '700', letterSpacing: '0.8px', textTransform: 'uppercase', marginTop: '1px' }}>
            PSNA · Dept. of CSE
          </div>
        </div>
      </div>

      {/* Info pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { icon: <FiCpu size={10} />, label: 'Dept. of CSE' },
          { icon: <FiMapPin size={10} />, label: 'Dindigul, TN' },
          { icon: <FiMail size={10} />, label: 'cseexamcell2023@gmail.com' },
        ].map(({ icon, label }) => (
          <span key={label} style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            background: '#F8F5F7', border: '1px solid #E8E2E5',
            borderRadius: '50px', padding: '3px 9px',
            fontSize: '10px', fontWeight: '600', color: '#6B5E63',
          }}>
            {icon} {label}
          </span>
        ))}
      </div>

      {/* Copyright */}
      <div style={{ display: 'flex', align: 'center', gap: '8px', flexShrink: 0 }}>
        <span style={{ fontSize: '11px', color: '#9B8F94', fontWeight: '600' }}>
          © 2026 CSE Exam Cell
        </span>
        <span style={{
          fontSize: '10px', fontWeight: '700', color: '#B42B6A',
          background: '#FDF2F7', border: '1px solid rgba(180,43,106,0.2)',
          borderRadius: '50px', padding: '2px 8px',
        }}>v 1.0</span>
      </div>
    </div>
  </footer>
);

export default Footer;
