import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiMenu, FiX, FiLogOut, FiClock, FiHome, FiClipboard, FiUser, FiLock, FiEye, FiEyeOff, FiMail, FiCheck, FiShield, FiLayout, FiLayers, FiFileText } from 'react-icons/fi';
import api from '../services/api';
import { toast } from 'react-toastify';
import ExcelFormatGuide from './ExcelFormatGuide';

/* ── Shared OTP spinner ── */
const Spinner = () => (
  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
);

const Navbar = () => {
  const [scrolled,   setScrolled]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDropUp, setProfileDropUp] = useState(false);
  const [adminInfo,   setAdminInfo]   = useState(null);
  const [formatGuideOpen, setFormatGuideOpen] = useState(false);

  // Change-password modal state
  const [cpOpen,    setCpOpen]    = useState(false);
  const [cpStep,    setCpStep]    = useState(1);   // 1=sendOtp 2=enterOtp 3=newPass
  const [cpLoading, setCpLoading] = useState(false);
  const [cpOtp,     setCpOtp]     = useState(['','','','','','']);
  const [cpNew,     setCpNew]     = useState('');
  const [cpConfirm, setCpConfirm] = useState('');
  const [cpShowNew, setCpShowNew] = useState(false);
  const [cpResend,  setCpResend]  = useState(0);  // countdown seconds

  const navigate = useNavigate();
  const location = useLocation();
  const profileRef = useRef(null);
  const profileMenuRef = useRef(null);
  const otpRefs    = useRef([]);
  const resendTimer = useRef(null);

  /* Flip the profile dropdown to open upward if there isn't enough
     viewport space below the trigger to show it fully downward. */
  useLayoutEffect(() => {
    if (!profileOpen) return;
    const trigger = profileRef.current;
    const menu = profileMenuRef.current;
    if (!trigger || !menu) return;
    const triggerRect = trigger.getBoundingClientRect();
    const menuHeight = menu.offsetHeight;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    setProfileDropUp(spaceBelow < menuHeight + 16 && triggerRect.top > menuHeight + 16);
  }, [profileOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Lock background scroll while the mobile drawer is open */
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileOpen]);

  /* Escape key closes the mobile drawer */
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  /* Load admin info on mount */
  useEffect(() => {
    api.get('/auth/me').then(r => setAdminInfo(r.data)).catch(() => {});
  }, []);

  /* Close profile dropdown when clicking outside */
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* Resend countdown */
  useEffect(() => {
    if (cpResend <= 0) return;
    resendTimer.current = setTimeout(() => setCpResend(p => p - 1), 1000);
    return () => clearTimeout(resendTimer.current);
  }, [cpResend]);

  const handleLogout = () => { localStorage.removeItem('token'); navigate('/login'); };
  const isActive = (p) => location.pathname === p;

  /* ── Change Password flow ── */
  const openCp = () => { setCpOpen(true); setCpStep(1); setCpOtp(['','','','','','']); setCpNew(''); setCpConfirm(''); setProfileOpen(false); };
  const closeCp = () => { setCpOpen(false); setCpStep(1); };

  const cpSendOtp = async () => {
    setCpLoading(true);
    try {
      await api.post('/auth/send-otp');
      toast.success('OTP sent to exam cell email');
      setCpStep(2);
      setCpResend(60);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send OTP');
    } finally { setCpLoading(false); }
  };

  const cpHandleOtpKey = (i, e) => {
    if (e.key === 'Backspace') {
      if (!cpOtp[i] && i > 0) {
        otpRefs.current[i - 1]?.focus();
        const n = [...cpOtp]; n[i-1] = '';
        setCpOtp(n);
      } else {
        const n = [...cpOtp]; n[i] = '';
        setCpOtp(n);
      }
    }
    if (e.key === 'ArrowLeft' && i > 0) otpRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const cpHandleOtpChange = (i, val) => {
    const v = val.replace(/\D/g,'');
    if (!v) {
      const next = [...cpOtp]; next[i] = '';
      setCpOtp(next);
      return;
    }

    if (v.length === 1) {
      const next = [...cpOtp]; next[i] = v;
      setCpOtp(next);
      if (i < 5) otpRefs.current[i + 1]?.focus();
    } else {
      const digits = v.slice(0, 6 - i).split('');
      const next = [...cpOtp];
      digits.forEach((d, idx) => {
        if (i + idx < 6) next[i + idx] = d;
      });
      setCpOtp(next);
      otpRefs.current[Math.min(i + digits.length, 5)]?.focus();
    }
  };

  const cpHandleOtpPaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6);
    if (text.length) {
      const next = text.split('').concat(Array(6).fill('')).slice(0,6);
      setCpOtp(next);
      otpRefs.current[Math.min(text.length, 5)]?.focus();
      e.preventDefault();
    }
  };

  const cpVerifyOtp = async () => {
    const otp = cpOtp.join('');
    if (otp.length < 6) return toast.warn('Enter all 6 digits');
    setCpLoading(true);
    try {
      await api.post('/auth/verify-otp', { otp });
      setCpStep(3);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Invalid OTP');
    } finally { setCpLoading(false); }
  };

  const cpSavePassword = async () => {
    if (cpNew.length < 6) return toast.warn('Password must be at least 6 characters');
    if (cpNew !== cpConfirm) return toast.error('Passwords do not match');
    setCpLoading(true);
    try {
      await api.patch('/auth/change-password', { otp: cpOtp.join(''), newPassword: cpNew });
      toast.success('Password changed successfully');
      closeCp();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to change password');
    } finally { setCpLoading(false); }
  };

  /* ── Styles ── */
  /* Floating glass navigation: rgba(255,255,255,.55) glass base, thin
     translucent border, soft shadow, fully pill-rounded. On scroll it
     grows slightly more blurred/opaque for readability, shrinks a touch,
     and deepens its shadow — all over the same 400ms curve. */
  const pillStyle = {
    display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', columnGap: '8px',
    height: '58px', padding: '0 20px',
    background: scrolled ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.68)',
    borderRadius: '999px',
    border: scrolled ? '1px solid rgba(255,255,255,0.45)' : '1px solid rgba(255,255,255,0.35)',
    boxShadow: scrolled
      ? '0 18px 50px rgba(0,0,0,0.09)'
      : '0 15px 45px rgba(0,0,0,0.06)',
    backdropFilter: scrolled ? 'blur(24px) saturate(1.6)' : 'blur(20px) saturate(1.5)',
    WebkitBackdropFilter: scrolled ? 'blur(24px) saturate(1.6)' : 'blur(20px) saturate(1.5)',
    transform: scrolled ? 'scale(0.985)' : 'scale(1)',
    transformOrigin: 'top center',
    transition: 'all 0.4s cubic-bezier(0.22,1,0.36,1)',
    maxWidth: '1100px', margin: '0 auto', gap: '8px',
    minWidth: 0,
  };
  const navLinkStyle = (active) => {
    return {
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '7px 16px', borderRadius: '50px', textDecoration: 'none',
      fontWeight: '700', fontSize: '13px', transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
      color: active ? '#B42B6A' : '#6B5E63',
      background: active ? 'rgba(180,43,106,0.09)' : 'transparent',
      border: '1.5px solid transparent',
      boxShadow: active ? '0 4px 16px rgba(180,43,106,0.16)' : 'none',
      transform: 'translateY(0)',
    };
  };
  const navLinkHoverIn = (e, active) => {
    if (active) return;
    e.currentTarget.style.background = 'rgba(180,43,106,0.06)';
    e.currentTarget.style.color = '#B42B6A';
    e.currentTarget.style.transform = 'translateY(-1px)';
  };
  const navLinkHoverOut = (e, active) => {
    if (active) return;
    e.currentTarget.style.background = 'transparent';
    e.currentTarget.style.color = '#6B5E63';
    e.currentTarget.style.transform = 'translateY(0)';
  };
  /* ── OTP step content ── */
  const cpStepContent = () => {
    if (cpStep === 1) return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg,#FDF2F7,#FEF7FB)', border: '2px solid rgba(180,43,106,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <FiLock size={24} color="#B42B6A" />
        </div>
        <h3 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: '18px', fontWeight: '800', color: '#1B0A12', margin: '0 0 8px' }}>Change Password</h3>
        <p style={{ color: '#6B5E63', fontSize: '13px', lineHeight: 1.6, margin: '0 0 20px' }}>
          An OTP will be sent to the exam cell email address.
        </p>
        <div style={{ background: '#FDF2F7', border: '1px solid rgba(180,43,106,0.2)', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', textAlign: 'left' }}>
          <FiMail size={16} color="#B42B6A" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#9B8F94', letterSpacing: '0.6px', textTransform: 'uppercase' }}>OTP will be sent to</div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#B42B6A' }}>{adminInfo?.email || 'cseexamcell2023@gmail.com'}</div>
          </div>
        </div>
        <button onClick={cpSendOtp} disabled={cpLoading} style={{ width: '100%', padding: '12px', borderRadius: '50px', border: 'none', background: 'linear-gradient(135deg,#B42B6A,#9A2259)', color: 'white', fontWeight: '700', fontSize: '14px', cursor: cpLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(180,43,106,0.3)' }}>
          {cpLoading ? <Spinner /> : <><FiMail size={14} /> Send OTP</>}
        </button>
      </div>
    );

    if (cpStep === 2) return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg,#FDF2F7,#FEF7FB)', border: '2px solid rgba(180,43,106,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <FiShield size={24} color="#B42B6A" />
        </div>
        <h3 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: '18px', fontWeight: '800', color: '#1B0A12', margin: '0 0 6px' }}>Enter OTP</h3>
        <p style={{ color: '#6B5E63', fontSize: '12px', lineHeight: 1.6, margin: '0 0 20px' }}>
          Check <strong style={{ color: '#B42B6A' }}>{adminInfo?.email || 'cseexamcell2023@gmail.com'}</strong> for the 6-digit code
        </p>
        {/* OTP boxes */}
        <div className="otp-row" style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }} onPaste={cpHandleOtpPaste}>
          {cpOtp.map((v, i) => (
            <input
              key={i}
              ref={el => otpRefs.current[i] = el}
              type="text" inputMode="numeric" maxLength={1} value={v}
              onChange={e => cpHandleOtpChange(i, e.target.value)}
              onKeyDown={e => cpHandleOtpKey(i, e)}
              onFocus={e => e.target.select()}
              className="otp-box"
              style={{
                width: 42, height: 50, textAlign: 'center', fontSize: '22px', fontWeight: '800',
                border: v ? '2.5px solid #B42B6A' : '2px solid #E8E2E5',
                borderRadius: '10px', outline: 'none', background: v ? '#FDF2F7' : 'white',
                color: '#B42B6A', fontFamily: "'Courier New',monospace", transition: 'all 0.15s',
              }}
            />
          ))}
        </div>
        <button onClick={cpVerifyOtp} disabled={cpLoading || cpOtp.join('').length < 6} style={{ width: '100%', padding: '12px', borderRadius: '50px', border: 'none', background: cpOtp.join('').length === 6 ? 'linear-gradient(135deg,#B42B6A,#9A2259)' : '#E8E2E5', color: cpOtp.join('').length === 6 ? 'white' : '#9B8F94', fontWeight: '700', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px', boxShadow: cpOtp.join('').length === 6 ? '0 4px 14px rgba(180,43,106,0.3)' : 'none', transition: 'all 0.2s' }}>
          {cpLoading ? <Spinner /> : <><FiCheck size={14} /> Verify OTP</>}
        </button>
        <button onClick={cpSendOtp} disabled={cpResend > 0 || cpLoading} style={{ background: 'none', border: 'none', color: cpResend > 0 ? '#9B8F94' : '#B42B6A', fontSize: '12px', fontWeight: '600', cursor: cpResend > 0 ? 'default' : 'pointer' }}>
          {cpResend > 0 ? `Resend in ${cpResend}s` : 'Resend OTP'}
        </button>
      </div>
    );

    if (cpStep === 3) return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#DCFCE7', border: '2px solid #86EFAC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <FiCheck size={24} color="#16A34A" />
          </div>
          <h3 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: '18px', fontWeight: '800', color: '#1B0A12', margin: '0 0 6px' }}>Set New Password</h3>
          <p style={{ color: '#6B5E63', fontSize: '12px', margin: 0 }}>OTP verified — create your new password</p>
        </div>
        {[
          { label: 'New Password', val: cpNew, set: setCpNew },
          { label: 'Confirm Password', val: cpConfirm, set: setCpConfirm },
        ].map(({ label, val, set }) => (
          <div key={label} style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#9B8F94', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={cpShowNew ? 'text' : 'password'} value={val}
                onChange={e => set(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', border: '1.5px solid #E8E2E5', borderRadius: '10px', padding: '10px 36px 10px 12px', fontSize: '14px', outline: 'none', background: '#FAFAFA', boxSizing: 'border-box' }}
              />
              <button type="button" onClick={() => setCpShowNew(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9B8F94', padding: 0 }}>
                {cpShowNew ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </div>
        ))}
        <button onClick={cpSavePassword} disabled={cpLoading} style={{ width: '100%', padding: '12px', borderRadius: '50px', border: 'none', background: 'linear-gradient(135deg,#B42B6A,#9A2259)', color: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px', boxShadow: '0 4px 14px rgba(180,43,106,0.3)' }}>
          {cpLoading ? <Spinner /> : <><FiLock size={14} /> Update Password</>}
        </button>
      </div>
    );
  };

  return (
    <>
      <header className="no-print navbar-header-outer" style={{
        position: 'sticky', top: 0, zIndex: 1000,
        padding: scrolled ? '4px 10px' : '8px 10px',
        transition: 'all 0.4s cubic-bezier(0.22,1,0.36,1)',
        background: 'transparent',
      }}>
        <div className="navbar-pill" style={pillStyle}>

          {/* Brand */}
          <Link to="/home" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <img src="/psna1logo.png" alt="PSNA" className="navbar-brand-logo" style={{ height: '36px', width: 'auto', objectFit: 'contain' }} />
            <div className="d-none d-sm-block navbar-logo-text" style={{ borderLeft: '1.5px solid #E8E2E5', paddingLeft: '10px' }}>
              <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: '800', fontSize: '17px', color: '#1B0A12', lineHeight: 1.15, letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
                Hallocate
              </div>
              <div style={{ fontSize: '9px', color: '#C2185B', fontWeight: '600', letterSpacing: '0.3px', marginTop: '1px', whiteSpace: 'nowrap' }}>
                E-Exam Hall Allocation · PSNA · CSE
              </div>
            </div>
          </Link>

          {/* Desktop nav — right-aligned grid column so it ends right before the divider/profile group */}
          <div className="d-none d-lg-flex align-items-center justify-content-end" style={{ gap: '6px' }}>
            <Link to="/home"       style={navLinkStyle(isActive('/home'))}      onMouseEnter={e=>navLinkHoverIn(e,isActive('/home'))}      onMouseLeave={e=>navLinkHoverOut(e,isActive('/home'))}>
              <FiHome size={14} /> Home
            </Link>
            <Link to="/history"    style={navLinkStyle(isActive('/history'))}   onMouseEnter={e=>navLinkHoverIn(e,isActive('/history'))}   onMouseLeave={e=>navLinkHoverOut(e,isActive('/history'))}>
              <FiClock size={14} /> History
            </Link>
            <Link to="/attendance" style={navLinkStyle(isActive('/attendance'))} onMouseEnter={e=>navLinkHoverIn(e,isActive('/attendance'))} onMouseLeave={e=>navLinkHoverOut(e,isActive('/attendance'))}>
              <FiClipboard size={14} /> Attendance
            </Link>
            <Link to="/hall-designer" style={navLinkStyle(isActive('/hall-designer'))} onMouseEnter={e=>navLinkHoverIn(e,isActive('/hall-designer'))} onMouseLeave={e=>navLinkHoverOut(e,isActive('/hall-designer'))}>
              <FiLayout size={14} /> Hall Designer
            </Link>
            <Link to="/seating-allotment" style={navLinkStyle(isActive('/seating-allotment'))} onMouseEnter={e=>navLinkHoverIn(e,isActive('/seating-allotment'))} onMouseLeave={e=>navLinkHoverOut(e,isActive('/seating-allotment'))}>
              <FiLayers size={14} /> Seating
            </Link>
          </div>

          {/* Right cell — profile (desktop) + hamburger (mobile) */}
          <div className="d-flex align-items-center justify-content-end" style={{ gap: '6px' }}>
            <div className="d-none d-lg-block" style={{ width: '1px', height: '20px', background: '#E8E2E5', margin: '0 4px' }} />

            {/* Profile icon */}
            <div ref={profileRef} className="d-none d-lg-block" style={{ position: 'relative' }}>
              <button
                onClick={() => setProfileOpen(v => !v)}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: profileOpen ? 'linear-gradient(135deg,#B42B6A,#9A2259)' : '#FDF2F7',
                  border: '1.5px solid rgba(180,43,106,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.2s', padding: 0,
                  color: profileOpen ? 'white' : '#B42B6A',
                  boxShadow: profileOpen ? '0 4px 14px rgba(180,43,106,0.35)' : 'none',
                }}
              >
                <FiUser size={16} />
              </button>

              {/* Profile dropdown — width clamps to the viewport so it can
                  never overflow the left edge on narrow screens, stays
                  right-edge-aligned to its trigger, and flips to open
                  upward (profileDropUp) when there isn't enough space
                  below — so it always stays fully inside the viewport. */}
              {profileOpen && (
                <div ref={profileMenuRef} style={{
                  position: 'absolute',
                  ...(profileDropUp ? { bottom: '44px' } : { top: '44px' }),
                  right: 0,
                  background: 'white', borderRadius: '16px', width: '240px', maxWidth: 'calc(100vw - 24px)',
                  maxHeight: 'calc(100vh - 88px)', overflowY: 'auto',
                  boxShadow: '0 16px 50px rgba(27,10,18,0.16)', border: '1px solid #E8E2E5',
                  animation: profileDropUp ? 'fadeUp 0.18s cubic-bezier(0.22,1,0.36,1)' : 'fadeDown 0.18s cubic-bezier(0.22,1,0.36,1)',
                  overflowX: 'hidden', zIndex: 200,
                }}>
                  {/* Avatar header */}
                  <div style={{ background: 'linear-gradient(135deg,#B42B6A 0%,#9A2259 100%)', padding: '18px 18px 14px', textAlign: 'center' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: '18px', fontWeight: '800', color: 'white' }}>
                      EC
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: 'white', lineHeight: 1.3 }}>
                      {adminInfo?.name || 'Exam Cell Incharge'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', marginTop: '2px' }}>
                      {adminInfo?.email || 'cseexamcell2023@gmail.com'}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ padding: '8px' }}>
                    <button onClick={openCp} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#1B0A12', textAlign: 'left', transition: 'all 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FDF2F7'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ width: 30, height: 30, borderRadius: '8px', background: '#FDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiLock size={14} color="#B42B6A" />
                      </div>
                      Change Password
                    </button>
                    <button onClick={() => { setProfileOpen(false); setFormatGuideOpen(true); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#1B0A12', textAlign: 'left', transition: 'all 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FDF2F7'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ width: 30, height: 30, borderRadius: '8px', background: '#FDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiFileText size={14} color="#B42B6A" />
                      </div>
                      Excel Format
                    </button>
                    <div style={{ height: '1px', background: '#E8E2E5', margin: '6px 4px' }} />
                    <button onClick={() => { setProfileOpen(false); handleLogout(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#B91C1C', textAlign: 'left', transition: 'all 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ width: 30, height: 30, borderRadius: '8px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FiLogOut size={14} color="#B91C1C" />
                      </div>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="d-lg-none mobile-drawer-trigger"
              onClick={() => setMobileOpen(v => !v)}
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-drawer"
            >
              {mobileOpen ? <FiX size={22} /> : <FiMenu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile / Tablet navigation drawer ── */}
      <div
        className={`mobile-drawer-backdrop d-lg-none ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen}
      />
      <div
        id="mobile-nav-drawer"
        className={`mobile-nav-drawer d-lg-none ${mobileOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!mobileOpen}
      >
        {/* Nav items — no repeated branding/header, no "Navigation" label */}
        <nav className="mobile-drawer-nav">
          {[
            { to: '/home',              icon: <FiHome size={18} />,      label: 'Home'          },
            { to: '/history',           icon: <FiClock size={18} />,     label: 'History'       },
            { to: '/attendance',        icon: <FiClipboard size={18} />, label: 'Attendance'    },
            { to: '/hall-designer',     icon: <FiLayout size={18} />,    label: 'Hall Designer' },
            { to: '/seating-allotment', icon: <FiLayers size={18} />,    label: 'Seating'       },
          ].map(({ to, icon, label }, idx) => (
            <Link
              key={to}
              to={to}
              className={`mobile-drawer-item ${isActive(to) ? 'active' : ''}`}
              style={{ transitionDelay: mobileOpen ? `${idx * 35 + 30}ms` : '0ms' }}
              onClick={() => setMobileOpen(false)}
            >
              {isActive(to) && <span className="mobile-drawer-indicator" />}
              <span className="mobile-drawer-icon">{icon}</span>
              <span className="mobile-drawer-label">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="mobile-drawer-divider" />

        {/* Compact profile row */}
        <div className="mobile-drawer-profile">
          <div className="mobile-drawer-avatar">EC</div>
          <div className="mobile-drawer-profile-text">
            <div className="mobile-drawer-name">{adminInfo?.name || 'Exam Cell Incharge'}</div>
            <div className="mobile-drawer-email">{adminInfo?.email || 'cseexamcell2023@gmail.com'}</div>
          </div>
        </div>

        <button className="mobile-drawer-changepw" style={{ width: '100%', marginTop: 4 }} onClick={() => { setMobileOpen(false); setFormatGuideOpen(true); }}>
          <FiFileText size={14} /> Excel Format
        </button>

        <div className="mobile-drawer-btn-row">
          <button className="mobile-drawer-changepw" onClick={() => { setMobileOpen(false); openCp(); }}>
            <FiLock size={14} /> Change Password
          </button>
          <button className="mobile-drawer-signout" onClick={() => { handleLogout(); setMobileOpen(false); }}>
            <FiLogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      {/* ── Change Password Modal ── */}
      {cpOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(27,10,18,0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={e => { if (e.target === e.currentTarget) closeCp(); }}>
          <div style={{ background: 'white', borderRadius: '22px', width: '100%', maxWidth: '380px', overflow: 'hidden', boxShadow: '0 32px 80px rgba(27,10,18,0.24)', animation: 'modalSlideUp 0.22s cubic-bezier(0.34,1.4,0.64,1)' }}>

            {/* Step indicator */}
            <div style={{ background: 'linear-gradient(135deg,#FDF2F7,#FEF7FB)', borderBottom: '1px solid rgba(180,43,106,0.12)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[1,2,3].map(s => (
                  <div key={s} style={{ width: s === cpStep ? 28 : 8, height: 8, borderRadius: '50px', transition: 'all 0.3s', background: s <= cpStep ? '#B42B6A' : '#E8E2E5' }} />
                ))}
              </div>
              <button onClick={closeCp} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8F94', padding: '2px', display: 'flex', alignItems: 'center' }}>
                <FiX size={18} />
              </button>
            </div>

            <div style={{ padding: '24px 24px 28px' }}>
              {cpStepContent()}
            </div>
          </div>
        </div>
      )}

      {/* ── Excel Format Guide Modal — reachable only from the profile
          menu, no dedicated route/URL. ── */}
      {formatGuideOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(27,10,18,0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={e => { if (e.target === e.currentTarget) setFormatGuideOpen(false); }}>
          <div style={{ background: 'white', borderRadius: '22px', width: '100%', maxWidth: '860px', maxHeight: 'calc(100vh - 48px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(27,10,18,0.24)', animation: 'modalSlideUp 0.22s cubic-bezier(0.34,1.4,0.64,1)' }}>
            <div style={{ background: 'linear-gradient(135deg,#FDF2F7,#FEF7FB)', borderBottom: '1px solid rgba(180,43,106,0.12)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 13.5, color: '#1B0A12' }}>
                <FiFileText size={15} color="#B42B6A" /> Excel Format Reference
              </div>
              <button onClick={() => setFormatGuideOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9B8F94', padding: '2px', display: 'flex', alignItems: 'center' }}>
                <FiX size={18} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', padding: '8px 8px 0' }}>
              <ExcelFormatGuide />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeDown {
          from { opacity:0; transform:translateY(-8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes modalSlideUp {
          from { opacity:0; transform:translateY(20px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes spin { to { transform:rotate(360deg); } }

        /* ══════════════════════════════════════════════
           Mobile / Tablet navigation drawer
           (desktop nav above is completely untouched)
        ══════════════════════════════════════════════ */

        .mobile-drawer-trigger {
          display: flex; align-items: center; justify-content: center;
          width: 44px; height: 44px; margin-left: auto;
          border: none; border-radius: 12px; background: transparent;
          color: #6B5E63; cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease, transform 0.12s ease;
        }
        .mobile-drawer-trigger:hover { background: rgba(180,43,106,0.08); color: #B42B6A; }
        .mobile-drawer-trigger:active { transform: scale(0.92); }
        .mobile-drawer-trigger:focus-visible { outline: 2px solid #B42B6A; outline-offset: 2px; }
        .mobile-drawer-trigger svg { width: 20px; height: 20px; }

        /* Mobile/tablet navbar: shorter, lighter blur, tighter padding,
           smaller logo — a lightweight floating bar rather than the
           taller desktop pill. Desktop (≥992px) is untouched. */
        @media (max-width: 991px) {
          .navbar-header-outer { padding: 6px 8px !important; }
          .navbar-pill {
            height: 58px !important;
            padding: 0 12px !important;
            backdrop-filter: blur(16px) saturate(1.4) !important;
            -webkit-backdrop-filter: blur(16px) saturate(1.4) !important;
          }
          .navbar-brand-logo { height: 28px !important; }
        }
        @media (max-width: 480px) {
          .navbar-header-outer { padding: max(4px, env(safe-area-inset-top)) 6px 4px !important; }
          .navbar-pill { height: 56px !important; }
          .mobile-nav-drawer { left: 13px !important; right: 13px !important; }
          .mobile-drawer-trigger { width: 40px; height: 40px; }
          .mobile-drawer-trigger svg { width: 19px; height: 19px; }
        }

        /* Backdrop */
        .mobile-drawer-backdrop {
          position: fixed; inset: 0; z-index: 1400;
          background: rgba(20,10,16,0.38);
          backdrop-filter: blur(0px);
          -webkit-backdrop-filter: blur(0px);
          opacity: 0; pointer-events: none;
          transition: opacity 0.32s cubic-bezier(0.22,1,0.36,1), backdrop-filter 0.32s ease;
        }
        .mobile-drawer-backdrop.open {
          opacity: 1; pointer-events: auto;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        /* Drawer panel — floats down from just below the navbar pill,
           inset from the screen edges like a premium dropdown card
           (not a full-height side sidebar). */
        .mobile-nav-drawer {
          position: fixed;
          top: max(70px, calc(env(safe-area-inset-top) + 62px));
          left: 16px; right: 16px; bottom: auto;
          z-index: 1500;
          width: auto;
          max-height: calc(100vh - 90px);
          display: flex; flex-direction: column;
          background: rgba(255,255,255,0.72);
          backdrop-filter: blur(18px) saturate(1.6);
          -webkit-backdrop-filter: blur(18px) saturate(1.6);
          border: 1px solid rgba(255,255,255,0.35);
          border-radius: 24px;
          box-shadow: 0 14px 40px rgba(27,10,18,0.12), 0 2px 8px rgba(27,10,18,0.06);
          padding: 12px 12px max(12px, env(safe-area-inset-bottom)) 12px;
          transform: translateY(-10px) scale(0.98);
          opacity: 0;
          pointer-events: none;
          transform-origin: top center;
          transition: transform 0.2s ease-in-out, opacity 0.2s ease-in-out;
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        /* Bottom scroll-affordance — a soft fade hints there's more
           content below when the drawer's content is taller than the
           viewport on short screens, instead of the last item just
           silently requiring a scroll with no visual cue. */
        .mobile-nav-drawer::after {
          content: '';
          position: sticky;
          bottom: 0; left: 0; right: 0;
          height: 22px;
          margin-top: -22px;
          background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0.85));
          pointer-events: none;
          border-radius: 0 0 24px 24px;
        }
        /* Short screens (e.g. 320×568) — compact the drawer so the
           whole menu, profile row and buttons fit with less scrolling. */
        @media (max-height: 640px) {
          .mobile-drawer-item { height: 40px !important; }
          .mobile-drawer-icon { width: 28px !important; height: 28px !important; }
          .mobile-drawer-profile { margin-top: 6px !important; padding: 6px !important; }
          .mobile-drawer-avatar { width: 26px !important; height: 26px !important; font-size: 10.5px !important; }
          .mobile-drawer-btn-row { margin-top: 8px !important; }
          .mobile-drawer-changepw, .mobile-drawer-signout { height: 36px !important; }
        }
        .mobile-nav-drawer.open {
          transform: translateY(0) scale(1);
          opacity: 1;
          pointer-events: auto;
        }

        .mobile-drawer-divider {
          height: 1px; margin: 10px 2px;
          background: linear-gradient(90deg, transparent, rgba(180,180,180,0.35), transparent);
        }

        /* Nav items */
        .mobile-drawer-nav {
          display: flex; flex-direction: column; gap: 3px;
        }
        .mobile-drawer-item {
          position: relative;
          display: flex; align-items: center; gap: 12px;
          height: 45px; padding: 0 14px 0 16px;
          border-radius: 13px; text-decoration: none;
          color: #4B4046; font-weight: 500; font-size: 14px;
          background: transparent;
          box-sizing: border-box;
          transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease-in-out, opacity 0.2s ease-in-out;
          transform: translateY(-8px); opacity: 0;
        }
        .mobile-nav-drawer.open .mobile-drawer-item {
          transform: translateY(0); opacity: 1;
        }
        .mobile-drawer-item:hover {
          background: rgba(180,43,106,0.06);
          color: #1B0A12;
          transform: translateY(-1px);
        }
        .mobile-drawer-item:active { transform: scale(0.98); }
        .mobile-drawer-item:focus-visible { outline: 2px solid #B42B6A; outline-offset: -2px; }
        .mobile-drawer-item.active {
          background: rgba(180,43,106,0.06);
          color: #B42B6A;
          font-weight: 600;
          box-shadow: 0 2px 10px rgba(180,43,106,0.07);
        }
        .mobile-drawer-indicator {
          position: absolute; left: 0; top: 50%; transform: translateY(-50%);
          width: 3px; height: 16px; border-radius: 0 3px 3px 0;
          background: linear-gradient(180deg,#C43078,#9A2259);
          box-shadow: 0 0 4px rgba(180,43,106,0.35);
        }
        .mobile-drawer-icon {
          display: flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; flex-shrink: 0;
          border-radius: 11px;
          background: rgba(107,94,99,0.06);
          color: inherit;
          transition: background 0.2s ease, transform 0.15s ease;
        }
        .mobile-drawer-item.active .mobile-drawer-icon {
          background: rgba(180,43,106,0.12);
        }
        .mobile-drawer-item:active .mobile-drawer-icon { transform: scale(0.9); }
        .mobile-drawer-label { flex: 1; letter-spacing: 0.1px; }

        /* Compact profile row — no oversized card */
        .mobile-drawer-profile {
          display: flex; align-items: center; gap: 10px;
          padding: 4px 6px 8px;
        }
        .mobile-drawer-avatar {
          display: flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; flex-shrink: 0;
          border-radius: 50%;
          background: linear-gradient(135deg,#B42B6A,#9A2259);
          color: white; font-weight: 800; font-size: 11.5px;
          box-shadow: 0 3px 10px rgba(180,43,106,0.28);
        }
        .mobile-drawer-profile-text { min-width: 0; }
        .mobile-drawer-name {
          font-size: 12.5px; font-weight: 800; color: #1B0A12;
          line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .mobile-drawer-email {
          font-size: 10.5px; font-weight: 600; color: #9B8F94;
          margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* Change Password / Sign Out — elegant outline pills, side by side */
        .mobile-drawer-btn-row {
          display: flex; gap: 8px; margin-top: 4px;
        }
        .mobile-drawer-changepw,
        .mobile-drawer-signout {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          flex: 1; height: 40px;
          border-radius: 999px;
          font-weight: 700; font-size: 12.5px; cursor: pointer;
          background: transparent;
          transition: background 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
        }
        .mobile-drawer-changepw {
          border: 1.5px solid rgba(180,43,106,0.3);
          color: #B42B6A;
        }
        .mobile-drawer-changepw:hover { background: rgba(180,43,106,0.08); box-shadow: 0 4px 14px rgba(180,43,106,0.16); }
        .mobile-drawer-changepw:active { transform: scale(0.97); }
        .mobile-drawer-changepw:focus-visible { outline: 2px solid #B42B6A; outline-offset: 2px; }

        .mobile-drawer-signout {
          border: 1.5px solid rgba(185,28,28,0.28);
          color: #B91C1C;
        }
        .mobile-drawer-signout:hover { background: rgba(185,28,28,0.08); box-shadow: 0 4px 14px rgba(185,28,28,0.16); }
        .mobile-drawer-signout:active { transform: scale(0.97); }
        .mobile-drawer-signout:focus-visible { outline: 2px solid #B91C1C; outline-offset: 2px; }

        /* Small phones */
        @media (max-width: 360px) {
          .mobile-nav-drawer { left: 11px; right: 11px; padding-left: 10px; padding-right: 10px; }
          .mobile-drawer-item { height: 42px; padding-left: 12px; padding-right: 10px; gap: 10px; }
          .mobile-drawer-icon { width: 30px; height: 30px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .mobile-nav-drawer, .mobile-drawer-backdrop, .mobile-drawer-item {
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </>
  );
};

export default Navbar;
