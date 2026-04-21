import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiMenu, FiX, FiLogOut, FiPlus, FiClock, FiHome, FiClipboard, FiUser, FiLock, FiEye, FiEyeOff, FiMail, FiCheck, FiShield } from 'react-icons/fi';
import api from '../services/api';
import { toast } from 'react-toastify';

/* ── Shared OTP spinner ── */
const Spinner = () => (
  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
);

const Navbar = () => {
  const [scrolled,   setScrolled]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminInfo,   setAdminInfo]   = useState(null);

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
  const otpRefs    = useRef([]);
  const resendTimer = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
  const pillStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    height: '52px', padding: '0 16px',
    background: scrolled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.97)',
    borderRadius: '40px',
    border: scrolled ? '1px solid rgba(180,43,106,0.12)' : '1px solid rgba(232,226,229,0.9)',
    boxShadow: scrolled
      ? '0 8px 40px rgba(27,10,18,0.14), 0 2px 12px rgba(180,43,106,0.08)'
      : '0 4px 20px rgba(27,10,18,0.07), 0 1px 4px rgba(180,43,106,0.04)',
    backdropFilter: scrolled ? 'blur(24px) saturate(1.6)' : 'blur(12px)',
    WebkitBackdropFilter: scrolled ? 'blur(24px) saturate(1.6)' : 'blur(12px)',
    transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
    maxWidth: '1100px', margin: '0 auto', gap: '8px',
    minWidth: 0,
  };
  const navLinkStyle = (active) => {
    return {
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '7px 16px', borderRadius: '50px', textDecoration: 'none',
      fontWeight: '700', fontSize: '13px', transition: 'all 0.2s',
      color: active ? '#B42B6A' : '#6B5E63',
      background: active ? '#FDF2F7' : 'transparent',
      border: `1.5px solid ${active ? 'rgba(180,43,106,0.25)' : 'transparent'}`,
      boxShadow: active ? '0 2px 8px rgba(180,43,106,0.25)' : 'none',
    };
  };
  const primaryNavBtn = {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 20px', borderRadius: '50px', textDecoration: 'none',
    fontWeight: '700', fontSize: '13px', cursor: 'pointer',
    background: 'linear-gradient(135deg,#B42B6A 0%,#9A2259 100%)',
    color: 'white', border: 'none',
    boxShadow: '0 4px 14px rgba(180,43,106,0.35)', transition: 'all 0.25s',
  };
  const mobileNavLinkStyle = (active) => {
    return {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '10px 14px', borderRadius: '12px', textDecoration: 'none',
      fontWeight: '700', fontSize: '14px', transition: 'all 0.2s',
      color: '#B42B6A', background: active ? '#FDF2F7' : 'transparent',
      border: `1.5px solid ${active ? 'rgba(180,43,106,0.2)' : 'transparent'}`,
      marginBottom: '4px',
    };
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
      <header className="no-print" style={{
        position: 'sticky', top: 0, zIndex: 1000,
        padding: scrolled ? '4px 10px' : '8px 10px',
        transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
        background: scrolled ? 'rgba(250,247,249,0.6)' : 'transparent',
        backdropFilter: scrolled ? 'blur(8px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(8px)' : 'none',
      }}>
        <div style={pillStyle}>

          {/* Brand */}
          <Link to="/home" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <img src="/psna1logo.png" alt="PSNA" style={{ height: '36px', width: 'auto', objectFit: 'contain' }} />
            <div className="d-none d-sm-block navbar-logo-text" style={{ borderLeft: '1.5px solid #E8E2E5', paddingLeft: '10px' }}>
              <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontWeight: '800', fontSize: '14px', color: '#1B0A12', lineHeight: 1.2, letterSpacing: '0.2px', whiteSpace: 'nowrap' }}>
                E-Exam Hall Allocation
              </div>
              <div style={{ fontSize: '9.5px', color: '#B42B6A', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '1px' }}>
                PSNA · Dept. of CSE
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="d-none d-lg-flex align-items-center" style={{ gap: '6px' }}>
            <Link to="/home"       style={navLinkStyle(isActive('/home'))}      onMouseEnter={e=>{if(!isActive('/home'))      {e.currentTarget.style.background='#FDF2F7';e.currentTarget.style.color='#B42B6A';e.currentTarget.style.border='1.5px solid rgba(180,43,106,0.2)';}}} onMouseLeave={e=>{if(!isActive('/home'))      {e.currentTarget.style.background='transparent';e.currentTarget.style.color='#6B5E63';e.currentTarget.style.border='1.5px solid transparent';}}}>
              <FiHome size={14} /> Home
            </Link>
            <Link to="/history"    style={navLinkStyle(isActive('/history'))}   onMouseEnter={e=>{if(!isActive('/history'))   {e.currentTarget.style.background='#FDF2F7';e.currentTarget.style.color='#B42B6A';e.currentTarget.style.border='1.5px solid rgba(180,43,106,0.2)';}}} onMouseLeave={e=>{if(!isActive('/history'))   {e.currentTarget.style.background='transparent';e.currentTarget.style.color='#6B5E63';e.currentTarget.style.border='1.5px solid transparent';}}}>
              <FiClock size={14} /> History
            </Link>
            <Link to="/attendance" style={navLinkStyle(isActive('/attendance'))} onMouseEnter={e=>{if(!isActive('/attendance')){e.currentTarget.style.background='#FDF2F7';e.currentTarget.style.color='#B42B6A';e.currentTarget.style.border='1.5px solid rgba(180,43,106,0.2)';}}} onMouseLeave={e=>{if(!isActive('/attendance')){e.currentTarget.style.background='transparent';e.currentTarget.style.color='#6B5E63';e.currentTarget.style.border='1.5px solid transparent';}}}>
              <FiClipboard size={14} /> Attendance
            </Link>

            <div style={{ width: '1px', height: '20px', background: '#E8E2E5', margin: '0 4px' }} />

            {/* Profile icon */}
            <div ref={profileRef} style={{ position: 'relative' }}>
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

              {/* Profile dropdown */}
              {profileOpen && (
                <div style={{
                  position: 'absolute', top: '44px', right: 0,
                  background: 'white', borderRadius: '16px', width: '240px',
                  boxShadow: '0 16px 50px rgba(27,10,18,0.16)', border: '1px solid #E8E2E5',
                  animation: 'fadeDown 0.18s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden', zIndex: 200,
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

            {/* New Allocation CTA */}
            <Link to="/allocate" style={primaryNavBtn}>
              <FiPlus size={14} /> New Allocation
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button className="d-lg-none btn border-0 p-1" onClick={() => setMobileOpen(v => !v)} style={{ color: '#6B5E63', background: 'transparent', marginLeft: 'auto' }}>
            {mobileOpen ? <FiX size={22} /> : <FiMenu size={22} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div style={{ background: 'white', borderRadius: '20px', margin: '6px 0 0', padding: '14px', boxShadow: '0 8px 32px rgba(27,10,18,0.1)', border: '1px solid #E8E2E5', animation: 'slideUp 0.2s ease', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}>
            {[
              { to: '/home',       icon: <FiHome size={15} />,       label: 'Home',           hue: 'home'       },
              { to: '/allocate',   icon: <FiPlus size={15} />,       label: 'New Allocation', hue: 'allocate'   },
              { to: '/history',    icon: <FiClock size={15} />,      label: 'History',        hue: 'history'    },
              { to: '/attendance', icon: <FiClipboard size={15} />,  label: 'Attendance',     hue: 'attendance' },
            ].map(({ to, icon, label, hue }) => (
              <Link key={to} to={to} style={mobileNavLinkStyle(isActive(to), hue)} onClick={() => setMobileOpen(false)}>
                <span style={{ width:32, height:32, borderRadius:'10px', background: isActive(to) ? 'white' : 'rgba(0,0,0,0.04)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {icon}
                </span>
                {label}
              </Link>
            ))}

            {/* Profile section in mobile */}
            <div style={{ background: '#FDF2F7', border: '1px solid rgba(180,43,106,0.15)', borderRadius: '12px', padding: '12px', marginBottom: '6px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1B0A12' }}>{adminInfo?.name || 'Exam Cell Incharge'}</div>
              <div style={{ fontSize: '11px', color: '#9B8F94', marginBottom: '8px' }}>{adminInfo?.email || 'cseexamcell2023@gmail.com'}</div>
              <button onClick={() => { setMobileOpen(false); openCp(); }} style={{ fontSize: '12px', fontWeight: '700', color: '#B42B6A', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <FiLock size={12} /> Change Password
              </button>
            </div>

            <hr style={{ borderColor: '#E8E2E5', margin: '10px 0' }} />
            <button onClick={() => { handleLogout(); setMobileOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '50px', border: 'none', background: 'transparent', color: '#B91C1C', fontWeight: '700', fontSize: '13px', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
              <FiLogOut size={14} /> Sign Out
            </button>
          </div>
        )}
      </header>

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

      <style>{`
        @keyframes fadeDown {
          from { opacity:0; transform:translateY(-8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes modalSlideUp {
          from { opacity:0; transform:translateY(20px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </>
  );
};

export default Navbar;
