import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import LegalCredits from './LegalCredits';

const SECTIONS = [
  {
    title: 'Acceptance of Terms',
    body: 'By accessing or using Hallocate, the examination hall allocation application of the Department of Computer Science and Engineering, PSNA College of Engineering & Technology, users agree to be bound by these Terms & Conditions. Users who do not agree to these terms should discontinue use of the application.',
  },
  {
    title: 'Authorized Usage',
    body: 'This application is intended solely for authorized examination administration, including hall allocation, seating arrangement, and attendance management within the Department of Computer Science and Engineering. Use for any other purpose is not permitted.',
  },
  {
    title: 'User Responsibilities',
    body: 'Users must keep their institutional access confidential, use the application only for legitimate examination-related purposes, and ensure the accuracy of any information they enter or modify.',
  },
  {
    title: 'Prohibited Activities',
    body: 'Users shall not attempt unauthorized access to the application. Users shall not manipulate examination records. Users shall not modify generated seating plans without authorization. Users shall not copy or redistribute institutional materials. Any attempt to interfere with the application’s intended operation is prohibited. Violations may result in institutional or legal action where applicable.',
  },
  {
    title: 'Institutional Guidelines',
    body: 'Use of this application is subject to the academic and administrative policies of PSNA College of Engineering & Technology. Users are expected to comply with all applicable institutional guidelines while using this application.',
  },
  {
    title: 'Intellectual Property',
    body: 'All content, design, and materials associated with this application are the exclusive property of its developers and the Department of Computer Science and Engineering. No part of this application may be copied, modified, or redistributed without prior written permission.',
  },
  {
    title: 'Limitation of Liability',
    body: 'This application is provided for internal departmental use. Its developers and mentors are not liable for any indirect, incidental, or consequential loss arising from the use of, or inability to use, this application.',
  },
  {
    title: 'Contact Information',
    body: 'For queries relating to these Terms & Conditions, contact the Examination Cell at cseexamcell2023@gmail.com.',
  },
];

const TermsAndConditions = () => {
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
          Terms &amp; Conditions
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

export default TermsAndConditions;
