import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Intro() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('start'); // 'start' | 'expand' | 'subtitle' | 'college' | 'ready' | 'exit'
  const [progress, setProgress] = useState(0);
  const [flash, setFlash] = useState(false);

  // If already logged in, bypass intro immediately
  useEffect(() => {
    if (localStorage.getItem('token')) {
      navigate('/home', { replace: true });
    }
  }, [navigate]);

  // Phase transition timeline
  useEffect(() => {
    // 0.8s: Expand icon and reveal "HALLOCATE" text next to it
    const tExpand = setTimeout(() => {
      setPhase('expand');
    }, 800);

    // 1.8s: Subtitle fades in and progress line starts
    const tSubtitle = setTimeout(() => {
      setPhase('subtitle');
    }, 1800);

    // 2.5s: College name and icon fade in below
    const tCollege = setTimeout(() => {
      setPhase('college');
    }, 2500);

    // 3.0s: Success checkmark appears
    const tReady = setTimeout(() => {
      setPhase('ready');
    }, 3000);

    // 3.5s: Flash transition and redirect to login page
    const tExit = setTimeout(() => {
      setPhase('exit');
      setFlash(true);
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 300);
    }, 3500);

    return () => {
      clearTimeout(tExpand);
      clearTimeout(tSubtitle);
      clearTimeout(tCollege);
      clearTimeout(tReady);
      clearTimeout(tExit);
    };
  }, [navigate]);

  // Animate progress line (1.8s to 3.0s = 1200ms)
  useEffect(() => {
    if (phase !== 'subtitle' && phase !== 'college') {
      if (phase === 'ready' || phase === 'exit') {
        setProgress(100);
      }
      return;
    }

    const startTime = Date.now();
    const duration = 1200;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.floor((elapsed / duration) * 100));
      setProgress(pct);

      if (pct >= 100) {
        clearInterval(interval);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [phase]);

  const handleSkip = () => {
    setFlash(true);
    setTimeout(() => {
      navigate('/login', { replace: true });
    }, 200);
  };

  const isExpanded = phase !== 'start';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');

        /* ── Monogram scale entry ── */
        @keyframes scaleInHA {
          0% {
            opacity: 0;
            transform: scale(0.9);
            filter: blur(8px);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            filter: blur(0);
          }
        }

        /* ── Background ripple rings ── */
        @keyframes ripplePulse {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.5; }
          100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; }
        }

        /* ── Exit transition ── */
        @keyframes exitZoomOut {
          to { transform: scale(1.05); opacity: 0; filter: blur(6px); }
        }

        @keyframes flashAnim {
          0% { opacity: 0; }
          40% { opacity: 1; }
          100% { opacity: 0; }
        }

        .ripple-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          border: 1px solid rgba(180, 43, 106, 0.08);
          border-radius: 50%;
          pointer-events: none;
          z-index: 1;
        }

        .bg-wave-left {
          position: absolute;
          left: -10%;
          top: -20%;
          width: 50%;
          height: 140%;
          background: radial-gradient(ellipse at left, rgba(180, 43, 106, 0.015) 0%, rgba(255,255,255,0) 70%);
          transform: rotate(-15deg);
          pointer-events: none;
        }
        .bg-wave-right {
          position: absolute;
          right: -10%;
          bottom: -20%;
          width: 50%;
          height: 140%;
          background: radial-gradient(ellipse at right, rgba(217, 70, 143, 0.015) 0%, rgba(255,255,255,0) 70%);
          transform: rotate(-15deg);
          pointer-events: none;
        }
      `}</style>

      {/* ── Page Canvas ── */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#FFFFFF',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        overflow: 'hidden',
        fontFamily: "'Poppins', sans-serif"
      }}>
        <div className="bg-wave-left" />
        <div className="bg-wave-right" />

        {/* Ripples during start phase */}
        {phase === 'start' && (
          <>
            <div className="ripple-ring" style={{ width: '280px', height: '280px', animation: 'ripplePulse 1.8s infinite ease-out' }} />
            <div className="ripple-ring" style={{ width: '400px', height: '400px', animation: 'ripplePulse 1.8s infinite ease-out 0.6s' }} />
          </>
        )}

        {/* ── Center Content Container ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
          maxWidth: '800px',
          animation: phase === 'exit' ? 'exitZoomOut 0.4s ease-in forwards' : 'none'
        }}>

          {/* ── Monogram & Brand Container (Flex-based expansion) ── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '110px',
            marginBottom: '16px',
            transition: 'all 0.75s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            {/* \"HALLOCATE\" text */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
            }}>
              <span style={{
                fontSize: '56px',
                fontWeight: '900',
                letterSpacing: '1px',
                background: 'linear-gradient(135deg, #B42B6A 0%, #D9468F 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.1,
                paddingRight: '4px',
                opacity: isExpanded ? 1 : 0,
                transform: isExpanded ? 'scale(1)' : 'scale(0.85)',
                transition: 'all 0.85s cubic-bezier(0.16, 1, 0.3, 1)',
              }}>
                HALLOCATE
              </span>
            </div>
          </div>

          {/* ── Subtitle (1.8s) ── */}
          <div style={{
            fontSize: '11px',
            fontWeight: '600',
            color: '#1F2937',
            letterSpacing: '4.5px',
            textTransform: 'uppercase',
            opacity: (phase !== 'start' && phase !== 'expand') ? 0.8 : 0,
            transform: (phase !== 'start' && phase !== 'expand') ? 'translateY(0)' : 'translateY(8px)',
            transition: 'all 0.5s ease-out',
            marginBottom: '24px',
            lineHeight: 1.5
          }}>
            E-EXAM HALL ALLOCATION SYSTEM
          </div>

          {/* ── Thin Loading Line & Status (1.8s) ── */}
          <div style={{ 
            height: '36px', 
            width: '240px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '8px', 
            opacity: (phase === 'subtitle' || phase === 'college') ? 1 : 0, 
            transition: 'opacity 0.4s' 
          }}>
            <div style={{ width: '100%', height: '2px', backgroundColor: '#FCE8F1', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                backgroundColor: '#B42B6A',
                borderRadius: '4px',
                transition: 'width 0.05s linear'
              }} />
            </div>
            <div style={{ fontSize: '9px', fontWeight: '700', color: '#6B7280', letterSpacing: '0.5px' }}>
              Initializing Allocation Engine...
            </div>
          </div>

          {/* ── College Label & Icon (2.5s) ── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '10px',
            opacity: (phase === 'college' || phase === 'ready' || phase === 'exit') ? 0.9 : 0,
            transform: (phase === 'college' || phase === 'ready' || phase === 'exit') ? 'translateY(0)' : 'translateY(8px)',
            transition: 'all 0.5s ease-out',
            marginBottom: '24px'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B42B6A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
            </svg>
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#6B7280', letterSpacing: '1px', textTransform: 'uppercase' }}>
              PSNA College of Engineering and Technology
            </span>
          </div>

          {/* ── Success Indicator badge (3.0s) ── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: (phase === 'ready' || phase === 'exit') ? 1 : 0,
            transform: (phase === 'ready' || phase === 'exit') ? 'scale(1)' : 'scale(0.8)',
            transition: 'all 0.4s cubic-bezier(0.34, 1.5, 0.64, 1)',
            height: '24px'
          }}>
            <div style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: '#B42B6A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(180, 43, 106, 0.25)'
            }}>
              <svg width="10" height="10" viewBox="0 0 20 20" fill="none">
                <path d="M5 10l3.5 3.5L15 6" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#B42B6A', letterSpacing: '0.5px' }}>
              Allocation System Ready
            </span>
          </div>

        </div>


        {/* ── Transition Flash ── */}
        {flash && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: '#FFFFFF',
            zIndex: 10000,
            animation: 'flashAnim 0.35s ease-out forwards',
            pointerEvents: 'none'
          }} />
        )}
      </div>
    </>
  );
}
