import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import LegalCredits from './LegalCredits';

const SECTIONS = [
  {
    title: 'Purpose of This Policy',
    body: 'This policy explains how Hallocate, the examination hall allocation application of the Department of Computer Science and Engineering, PSNA College of Engineering & Technology, handles the information used to administer examinations.',
  },
  {
    title: 'Information We Handle',
    body: 'The application works with examination-related information such as student roll numbers, sections, hall assignments, seating arrangements, attendance records, and staff login details entered by authorized examination cell members. No personal information is collected beyond what is required for examination administration.',
  },
  {
    title: 'How Information Is Used',
    body: 'Information is used solely to allocate examination halls, generate seating charts, record attendance, and produce official examination documents such as hall plans. Information is not used for any purpose unrelated to examination administration.',
  },
  {
    title: 'Information Sharing',
    body: 'Examination information is accessible only to authorized members of the Examination Cell and Department of Computer Science and Engineering. Information is not shared with any external party except where required by institutional or academic policy.',
  },
  {
    title: 'Retention of Records',
    body: 'Examination records are retained for as long as necessary to support academic administration, record-keeping, and institutional requirements, after which they may be archived or removed in accordance with departmental practice.',
  },
  {
    title: 'Protection of Information',
    body: 'Reasonable administrative and access-control safeguards are maintained to protect examination information from unauthorized access, alteration, or misuse. Access to the application is restricted to authorized examination cell personnel.',
  },
  {
    title: 'User Responsibilities',
    body: 'Users must keep their login credentials confidential and use the application only for legitimate examination-related purposes. Users are responsible for the accuracy of information they enter or modify.',
  },
  {
    title: 'Changes to This Policy',
    body: 'This policy may be updated from time to time to reflect changes in institutional practice. The effective date below indicates when this policy was last revised.',
  },
  {
    title: 'Contact Information',
    body: 'For queries relating to this Privacy Policy, contact the Examination Cell at cseexamcell2023@gmail.com.',
  },
];

const PrivacyPolicy = () => {
  return (
    <div className="page-enter legal-page" style={{ maxWidth: 820, margin: '20px auto', padding: '36px 40px 48px' }}>
      <Link
        to="/home"
        className="legal-back-link"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 50, border: '1.5px solid #E8E2E5',
          background: 'white', color: '#6B5E63', fontWeight: 700, fontSize: 13,
          textDecoration: 'none', marginBottom: 28,
        }}
      >
        <FiArrowLeft size={13} /> Back to Home
      </Link>

      <div className="legal-header-row" style={{ marginBottom: 8 }}>
        <h1 className="legal-title" style={{
          fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 900,
          fontSize: 'clamp(24px,4vw,30px)', color: '#000000', margin: 0,
        }}>
          Privacy Policy
        </h1>
      </div>

      <p className="legal-subtitle" style={{ color: '#9B8F94', fontSize: 13, margin: '0 0 24px' }}>
        Hallocate &middot; E-Exam Hall Allocation System &middot; PSNA College of Engineering &amp; Technology, Dept. of CSE
      </p>

      <div className="legal-divider" style={{ borderTop: '1px solid #E8E2E5', marginBottom: 28 }} />

      <div className="legal-plain-sections" style={{ display: 'flex', flexDirection: 'column' }}>
        {SECTIONS.map((section, i) => (
          <div
            key={section.title}
            className="legal-plain-section"
            style={{
              paddingBottom: 22,
              marginBottom: 22,
              borderBottom: i < SECTIONS.length - 1 ? '1px solid #F0ECEE' : 'none',
            }}
          >
            <h2 className="legal-section-title" style={{
              fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 800,
              fontSize: 17, color: '#1B0A12', margin: '0 0 8px',
            }}>
              {section.title}
            </h2>
            <p className="legal-section-body" style={{ fontSize: 14.5, color: '#4B4046', lineHeight: 1.8, margin: 0, textAlign: 'left' }}>
              {section.body}
            </p>
          </div>
        ))}
      </div>

      <LegalCredits />
    </div>
  );
};

export default PrivacyPolicy;
