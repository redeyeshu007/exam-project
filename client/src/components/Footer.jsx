import { Link } from 'react-router-dom';

const Footer = () => (
  <footer className="no-print home-footer-outer">
    <div className="home-footer-compact">
      <div className="home-footer-brand">
        <img src="/psna2logo.png" alt="PSNA" className="home-footer-brand-logo" />
        <div className="home-footer-brand-text">
          <div className="home-footer-brand-title">Hallocate</div>
          <div className="home-footer-brand-sub">PSNA College of Engineering and Technology</div>
          <div className="home-footer-brand-sub home-footer-brand-sub-dept">Department of Computer Science &amp; Engineering</div>
        </div>
      </div>

      <div className="home-footer-copy">
        &copy; 2026 E-Exam Hall Allocation System. All Rights Reserved.
      </div>

      <div className="home-footer-links">
        <Link to="/privacy-policy" className="home-footer-link">Privacy Policy</Link>
        <Link to="/terms-and-conditions" className="home-footer-link">Terms &amp; Conditions</Link>
        <Link to="/contact" className="home-footer-link">Contact</Link>
      </div>
    </div>
  </footer>
);

export default Footer;
