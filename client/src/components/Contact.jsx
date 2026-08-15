import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import LegalCredits from './LegalCredits';

const CONTACT_EMAIL = 'examcell@psnacet.edu.in';

const Contact = () => {
  return (
    <div className="page-enter legal-page" style={{ maxWidth: 680, margin: '20px auto', padding: '36px 40px 48px' }}>
      <Link
        to="/home"
        className="legal-back-link"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 50, border: '1.5px solid #E8E2E5',
          background: 'white', color: '#6B5E63', fontWeight: 700, fontSize: 13,
          textDecoration: 'none', marginBottom: 24,
        }}
      >
        <FiArrowLeft size={13} /> Back to Home
      </Link>

      <div className="legal-header-row" style={{ marginBottom: 6 }}>
        <h1 className="legal-title" style={{
          fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 900,
          fontSize: 'clamp(22px,4vw,30px)', color: '#000000', margin: 0,
        }}>
          Contact
        </h1>
      </div>
      <p className="legal-subtitle" style={{ color: '#9B8F94', fontSize: 13, margin: '0 0 28px' }}>
        Hallocate &middot; E-Exam Hall Allocation System &middot; PSNA College of Engineering &amp; Technology, Dept. of CSE
      </p>
      <div className="legal-divider" style={{ borderTop: '1px solid #E8E2E5', marginBottom: 28 }} />

      {/* Institutional contact information — plain document sections,
          consistent with Privacy Policy / Terms & Conditions. */}
      <div className="legal-plain-sections" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="legal-plain-section" style={{ paddingBottom: 22, marginBottom: 22, borderBottom: '1px solid #F0ECEE' }}>
          <div className="contact-eyebrow" style={{
            fontSize: 10.5, fontWeight: 800, color: '#9B8F94', letterSpacing: '0.6px',
            textTransform: 'uppercase', marginBottom: 6,
          }}>
            Examination Cell
          </div>
          <h2 className="legal-section-title" style={{
            fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 800,
            fontSize: 17, color: '#1B0A12', margin: '0 0 4px',
          }}>
            Department of Computer Science &amp; Engineering
          </h2>
          <p className="legal-section-body" style={{ fontSize: 13, color: '#6B5E63', fontWeight: 600, margin: 0 }}>
            PSNA College of Engineering and Technology
          </p>
        </div>

        <div
          className="legal-plain-section contact-email-section"
          style={{
            paddingBottom: 22, marginBottom: 22, borderBottom: '1px solid #F0ECEE',
            borderLeft: '3px solid rgba(194,24,91,0.4)', paddingLeft: 16,
          }}
        >
          <h2 className="legal-section-title" style={{
            fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 800,
            fontSize: 17, color: '#1B0A12', margin: '0 0 8px',
          }}>
            Email
          </h2>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            style={{ fontSize: 14.5, fontWeight: 700, color: '#B42B6A', textDecoration: 'none' }}
            onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
            onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
          >
            {CONTACT_EMAIL}
          </a>
        </div>

        <div className="legal-plain-section">
          <h2 className="legal-section-title" style={{
            fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 800,
            fontSize: 17, color: '#1B0A12', margin: '0 0 8px',
          }}>
            Office
          </h2>
          <p className="legal-section-body" style={{ fontSize: 14.5, color: '#4B4046', lineHeight: 1.8, margin: 0 }}>
            PSNA College of Engineering and Technology<br />
            Department of Computer Science &amp; Engineering
          </p>
        </div>
      </div>

      <LegalCredits />
    </div>
  );
};

export default Contact;
