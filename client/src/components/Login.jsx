import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiMail, FiLock, FiEye, FiEyeOff, FiArrowLeft, FiShield, FiCheck } from 'react-icons/fi';

const EXAM_EMAIL = 'cseexamcell2023@gmail.com';

const Spinner = () => (
  <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
);

const Login = () => {
  // Login fields
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  // View: 'login' | 'fp-send' | 'fp-otp' | 'fp-pass'
  const [view,    setView]    = useState('login');
  const [fpOtp,   setFpOtp]   = useState(['','','','','','']);
  const [fpNew,   setFpNew]   = useState('');
  const [fpConf,  setFpConf]  = useState('');
  const [fpShowP, setFpShowP] = useState(false);
  const [fpLoad,  setFpLoad]  = useState(false);
  const [resend,  setResend]  = useState(0);

  const navigate  = useNavigate();
  const otpRefs   = useRef([]);
  const timerRef  = useRef(null);

  useEffect(() => {
    if (resend <= 0) return;
    timerRef.current = setTimeout(() => setResend(p => p - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [resend]);

  /* ── Login ── */
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      toast.success('Login Successful');
      navigate('/home');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  /* ── Forgot password: send OTP ── */
  const fpSendOtp = async () => {
    setFpLoad(true);
    try {
      await api.post('/auth/send-otp');
      toast.success('OTP sent to exam cell email');
      setView('fp-otp');
      setResend(60);
      setTimeout(() => otpRefs.current[0]?.focus(), 120);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to send OTP. Check server email config.');
    } finally { setFpLoad(false); }
  };

  /* ── OTP box handlers ── */
  const otpChange = (i, val) => {
    const v = val.replace(/\D/g,'');
    if (!v) {
      const n = [...fpOtp]; n[i] = '';
      setFpOtp(n);
      return;
    }

    // Handle single character entry
    if (v.length === 1) {
      const n = [...fpOtp]; n[i] = v;
      setFpOtp(n);
      if (i < 5) otpRefs.current[i + 1]?.focus();
    } 
    // Handle multiple characters (like paste or fast typing)
    else {
      const digits = v.slice(0, 6 - i).split('');
      const n = [...fpOtp];
      digits.forEach((d, idx) => {
        if (i + idx < 6) n[i + idx] = d;
      });
      setFpOtp(n);
      otpRefs.current[Math.min(i + digits.length, 5)]?.focus();
    }
  };

  const otpKey = (i, e) => {
    if (e.key === 'Backspace') {
      if (!fpOtp[i] && i > 0) {
        otpRefs.current[i - 1]?.focus();
        const n = [...fpOtp]; n[i-1] = '';
        setFpOtp(n);
      } else {
        const n = [...fpOtp]; n[i] = '';
        setFpOtp(n);
      }
    }
    if (e.key === 'ArrowLeft' && i > 0) otpRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const otpPaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6);
    if (text.length) {
      const n = text.split('').concat(Array(6).fill('')).slice(0,6);
      setFpOtp(n);
      otpRefs.current[Math.min(text.length, 5)]?.focus();
      e.preventDefault();
    }
  };

  /* ── Verify OTP ── */
  const fpVerify = async () => {
    const otp = fpOtp.join('');
    if (otp.length < 6) return toast.warn('Enter all 6 digits');
    setFpLoad(true);
    try {
      await api.post('/auth/verify-otp', { otp });
      setView('fp-pass');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Invalid OTP');
    } finally { setFpLoad(false); }
  };

  /* ── Reset password ── */
  const fpReset = async () => {
    if (fpNew.length < 6) return toast.warn('Password must be at least 6 characters');
    if (fpNew !== fpConf)  return toast.error('Passwords do not match');
    setFpLoad(true);
    try {
      await api.post('/auth/reset-password', { otp: fpOtp.join(''), newPassword: fpNew });
      toast.success('Password updated! Please log in.');
      setView('login');
      setFpOtp(['','','','','','']); setFpNew(''); setFpConf('');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to reset password');
    } finally { setFpLoad(false); }
  };

  /* ── Styles ── */
  const inputBase = {
    height: '52px', fontSize: '15px',
    background: '#FAFAFA', border: '1.5px solid #E8E2E5',
    borderRadius: '12px', paddingLeft: '48px', outline: 'none',
    width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  };
  const iconStyle = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: '16px', color: '#9B8F94' };

  /* ── Render views ── */
  const renderFpSend = () => (
    <div>
      <button onClick={() => setView('login')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#9B8F94', fontSize: '13px', fontWeight: '600', padding: '0 0 16px' }}>
        <FiArrowLeft size={14} /> Back to Login
      </button>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#FDF2F7,#FEF7FB)', border: '2px solid rgba(180,43,106,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <FiLock size={26} color="#B42B6A" />
        </div>
        <h3 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: '20px', fontWeight: '800', color: '#1B0A12', margin: '0 0 8px' }}>Forgot Password?</h3>
        <p style={{ color: '#6B5E63', fontSize: '13px', lineHeight: 1.7, margin: 0 }}>
          An OTP will be sent to the registered exam cell email to verify your identity.
        </p>
      </div>
      <div style={{ background: '#FDF2F7', border: '1.5px solid rgba(180,43,106,0.2)', borderRadius: '14px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(180,43,106,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FiMail size={16} color="#B42B6A" />
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#9B8F94', letterSpacing: '0.7px', textTransform: 'uppercase' }}>OTP will be sent to</div>
          <div style={{ fontSize: '14px', fontWeight: '800', color: '#B42B6A' }}>{EXAM_EMAIL}</div>
        </div>
      </div>
      <button onClick={fpSendOtp} disabled={fpLoad} style={{ width: '100%', height: '52px', borderRadius: '50px', border: 'none', background: 'linear-gradient(135deg,#B42B6A,#9A2259)', color: 'white', fontWeight: '700', fontSize: '15px', cursor: fpLoad ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 6px 20px rgba(180,43,106,0.35)' }}>
        {fpLoad ? <Spinner /> : <><FiMail size={16} /> Send OTP</>}
      </button>
    </div>
  );

  const renderFpOtp = () => (
    <div>
      <button onClick={() => { setView('fp-send'); setFpOtp(['','','','','','']); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: '#9B8F94', fontSize: '13px', fontWeight: '600', padding: '0 0 16px' }}>
        <FiArrowLeft size={14} /> Back
      </button>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#FDF2F7,#FEF7FB)', border: '2px solid rgba(180,43,106,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <FiShield size={26} color="#B42B6A" />
        </div>
        <h3 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: '20px', fontWeight: '800', color: '#1B0A12', margin: '0 0 6px' }}>Enter OTP</h3>
        <p style={{ color: '#6B5E63', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
          Check <strong style={{ color: '#B42B6A' }}>{EXAM_EMAIL}</strong><br/>for the 6-digit verification code
        </p>
      </div>

      {/* OTP boxes */}
      <div className="otp-row" style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '24px' }} onPaste={otpPaste}>
        {fpOtp.map((v, i) => (
          <input
            key={i} ref={el => otpRefs.current[i] = el}
            type="text" inputMode="numeric" maxLength={1} value={v}
            onChange={e => otpChange(i, e.target.value)}
            onKeyDown={e => otpKey(i, e)}
            onFocus={e => e.target.select()}
            className="otp-box"
            style={{
              width: 48, height: 58, textAlign: 'center', fontSize: '26px', fontWeight: '900',
              border: v ? '2.5px solid #B42B6A' : '2px solid #E8E2E5',
              borderRadius: '14px', outline: 'none',
              background: v ? 'linear-gradient(135deg,#FDF2F7,#FEF7FB)' : 'white',
              color: '#B42B6A', fontFamily: "'Courier New',monospace",
              boxShadow: v ? '0 2px 12px rgba(180,43,106,0.18)' : 'none',
              transition: 'all 0.15s',
            }}
          />
        ))}
      </div>

      <button onClick={fpVerify} disabled={fpLoad || fpOtp.join('').length < 6} style={{ width: '100%', height: '52px', borderRadius: '50px', border: 'none', background: fpOtp.join('').length === 6 ? 'linear-gradient(135deg,#B42B6A,#9A2259)' : '#E8E2E5', color: fpOtp.join('').length === 6 ? 'white' : '#9B8F94', fontWeight: '700', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '14px', boxShadow: fpOtp.join('').length === 6 ? '0 6px 20px rgba(180,43,106,0.35)' : 'none', transition: 'all 0.2s' }}>
        {fpLoad ? <Spinner /> : <><FiCheck size={16} /> Verify OTP</>}
      </button>

      <div style={{ textAlign: 'center' }}>
        <button onClick={fpSendOtp} disabled={resend > 0 || fpLoad} style={{ background: 'none', border: 'none', color: resend > 0 ? '#9B8F94' : '#B42B6A', fontSize: '13px', fontWeight: '700', cursor: resend > 0 ? 'default' : 'pointer' }}>
          {resend > 0 ? `Resend OTP in ${resend}s` : 'Resend OTP'}
        </button>
      </div>
    </div>
  );

  const renderFpPass = () => (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#DCFCE7', border: '2px solid #86EFAC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <FiCheck size={26} color="#16A34A" />
        </div>
        <h3 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: '20px', fontWeight: '800', color: '#1B0A12', margin: '0 0 6px' }}>Set New Password</h3>
        <p style={{ color: '#6B5E63', fontSize: '13px', margin: 0 }}>Identity verified — create a strong new password</p>
      </div>

      {[
        { label: 'New Password', val: fpNew, set: setFpNew, placeholder: 'Minimum 6 characters' },
        { label: 'Confirm Password', val: fpConf, set: setFpConf, placeholder: 'Re-enter password' },
      ].map(({ label, val, set, placeholder }) => (
        <div key={label} style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#9B8F94', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: '5px' }}>{label}</label>
          <div style={{ position: 'relative' }}>
            <FiLock size={18} style={{ ...iconStyle }} />
            <input
              type={fpShowP ? 'text' : 'password'} value={val}
              onChange={e => set(e.target.value)} placeholder={placeholder}
              style={{ ...inputBase, paddingRight: '44px' }}
              onFocus={e => e.target.style.borderColor = '#B42B6A'}
              onBlur={e => e.target.style.borderColor = '#E8E2E5'}
            />
            <button type="button" onClick={() => setFpShowP(v => !v)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9B8F94', padding: 0 }}>
              {fpShowP ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            </button>
          </div>
        </div>
      ))}

      {fpNew && fpConf && fpNew !== fpConf && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '8px 12px', fontSize: '12px', color: '#B91C1C', fontWeight: '600', marginBottom: '10px' }}>
          Passwords do not match
        </div>
      )}

      <button onClick={fpReset} disabled={fpLoad} style={{ width: '100%', height: '52px', borderRadius: '50px', border: 'none', background: 'linear-gradient(135deg,#B42B6A,#9A2259)', color: 'white', fontWeight: '700', fontSize: '15px', cursor: fpLoad ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px', boxShadow: '0 6px 20px rgba(180,43,106,0.35)' }}>
        {fpLoad ? <Spinner /> : <><FiLock size={16} /> Update Password</>}
      </button>
    </div>
  );

  /* ── Step dots ── */
  const fpViews = ['fp-send','fp-otp','fp-pass'];
  const fpIdx   = fpViews.indexOf(view);

  return (
    <div style={{ background: 'linear-gradient(135deg,#FAF7F9 0%,#FEF3F8 100%)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px' }}>
      <div className="login-card-inner" style={{ background: 'white', borderRadius: '24px', padding: '36px 32px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 60px rgba(27,10,18,0.12)', border: '1px solid #F0ECF0' }}>

        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img src="/psna1logo.png" alt="PSNA Logo" style={{ height: '72px', objectFit: 'contain', marginBottom: '16px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', gap: '10px' }}>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right,transparent,#E8E2E5)' }} />
            <span style={{ color: '#C9BFC5', fontSize: '10px' }}>♦</span>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left,transparent,#E8E2E5)' }} />
          </div>
          <h2 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: '22px', fontWeight: '800', color: '#1B0A12', margin: '0 0 4px', lineHeight: 1.3 }}>
            E-Exam Hall Allocation<br/>System
          </h2>
          <p style={{ color: '#9B8F94', fontSize: '11px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', margin: '0' }}>
            Department of CSE
          </p>
        </div>

        {/* FP step indicator */}
        {view !== 'login' && fpIdx >= 0 && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
            {fpViews.map((_, s) => (
              <div key={s} style={{ height: 4, flex: 1, borderRadius: '50px', background: s <= fpIdx ? '#B42B6A' : '#E8E2E5', transition: 'all 0.3s' }} />
            ))}
          </div>
        )}

        {/* Login form */}
        {view === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ position: 'relative' }}>
              <FiMail size={18} style={iconStyle} />
              <input
                type="email" placeholder="Email address" value={email}
                onChange={e => setEmail(e.target.value)} required
                style={inputBase}
                onFocus={e => e.target.style.borderColor = '#B42B6A'}
                onBlur={e => e.target.style.borderColor = '#E8E2E5'}
              />
            </div>

            <div style={{ position: 'relative' }}>
              <FiLock size={18} style={iconStyle} />
              <input
                type={showPass ? 'text' : 'password'} placeholder="Password" value={password}
                onChange={e => setPassword(e.target.value)} required
                style={{ ...inputBase, paddingRight: '48px' }}
                onFocus={e => e.target.style.borderColor = '#B42B6A'}
                onBlur={e => e.target.style.borderColor = '#E8E2E5'}
              />
              <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9B8F94', padding: 0 }}>
                {showPass ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>

            <div style={{ textAlign: 'right', marginTop: '-4px' }}>
              <button type="button" onClick={() => setView('fp-send')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B42B6A', fontSize: '13px', fontWeight: '700', padding: 0 }}>
                Forgot Password?
              </button>
            </div>

            <button type="submit" disabled={loading} style={{ height: '52px', borderRadius: '50px', border: 'none', background: 'linear-gradient(135deg,#B42B6A,#9A2259)', color: 'white', fontWeight: '800', fontSize: '15px', letterSpacing: '1.5px', cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 6px 20px rgba(180,43,106,0.35)', marginTop: '4px' }}>
              {loading ? <Spinner /> : 'LOGIN'}
            </button>
          </form>
        )}

        {view === 'fp-send' && renderFpSend()}
        {view === 'fp-otp'  && renderFpOtp()}
        {view === 'fp-pass' && renderFpPass()}

        <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '18px', borderTop: '1px solid #F0ECF0' }}>
          <p style={{ color: '#C9BFC5', fontSize: '12px', margin: 0, fontWeight: '600' }}>
            © 2026 CSE Exam Cell, PSNA
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Login;
