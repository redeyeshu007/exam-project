import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { m } from 'framer-motion';
import {
  FiGrid, FiClipboard, FiArrowRight, FiLayout, FiLayers, FiClock, FiPrinter, FiHome,
} from 'react-icons/fi';
import { EASE, fadeUp, staggerContainer } from '../motion';

/* Premium Rose — uniform palette for the mobile launcher buttons */
const PREMIUM_ROSE = { bg: '#FFF5F8', border: '#C2185B', text: '#AD1457' };

/* ── Looping typewriter hero title — "Welcome to " is static (never
   animated); only "Hallocate" (gradient) is typed character-by-character,
   holds, deletes, and retypes. A blinking caret follows the current
   typing/deleting position of the "Hallocate" word only. ── */
const HERO_PREFIX = 'Welcome to ';
const HERO_WORD = 'Hallocate';
const TYPE_SPEED_MS = 55;
const DELETE_SPEED_MS = 35;
const HOLD_MS = 3500;
const RESTART_DELAY_MS = 400;

const TypingHeroTitle = () => {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    let alive = true;
    let timer;

    const typeFrom = (idx) => {
      if (!alive) return;
      setTyped(HERO_WORD.slice(0, idx));
      if (idx < HERO_WORD.length) {
        timer = setTimeout(() => typeFrom(idx + 1), TYPE_SPEED_MS);
      } else {
        timer = setTimeout(() => { if (alive) deleteFrom(HERO_WORD.length); }, HOLD_MS);
      }
    };

    const deleteFrom = (idx) => {
      if (!alive) return;
      setTyped(HERO_WORD.slice(0, idx));
      if (idx > 0) {
        timer = setTimeout(() => deleteFrom(idx - 1), DELETE_SPEED_MS);
      } else {
        timer = setTimeout(() => typeFrom(0), RESTART_DELAY_MS);
      }
    };

    typeFrom(0);
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  return (
    <h1 className="home-welcome-title">
      {HERO_PREFIX}
      <span className="home-hero-gradient-text">{typed}</span>
      <span className="home-hero-caret" aria-hidden="true" />
    </h1>
  );
};

const CARDS = [
  {
    id: 'allocate',
    icon: FiGrid,
    iconBg: '#FDF2F7',
    iconColor: '#B42B6A',
    title: 'E-Exam Hall Generation',
    desc: 'Allocate students to exam halls automatically. Configure exam details, sections, and hall capacities — the system assigns seats and generates a ready-to-print hall plan.',
    chips: ['Standard Allocation', 'Elective Seating'],
    chipColor: '#B42B6A',
    chipBg: '#FDF2F7',
    chipBorder: 'rgba(180,43,106,0.18)',
    btnLabel: 'Go to Hall Allocation',
    btnStyle: 'primary',
    path: '/allocate',
    mobileLabel: 'Hall Allocation',
    mobileTint: PREMIUM_ROSE,
  },
  {
    id: 'attendance',
    icon: FiClipboard,
    iconBg: '#FDF2F7',
    iconColor: '#B42B6A',
    title: 'Attendance Sheet Generation',
    desc: 'Generate per-hall attendance sheets from a saved exam allocation. Sheets follow the official PSNA format with student register numbers, names, and exam date columns.',
    chips: ['PSNA Format', 'Per-Hall Pages', 'Print Ready'],
    chipColor: '#B42B6A',
    chipBg: '#FDF2F7',
    chipBorder: 'rgba(180,43,106,0.18)',
    btnLabel: 'Go to Attendance Sheets',
    btnStyle: 'outline-pink',
    path: '/attendance',
    mobileLabel: 'Attendance Sheets',
    mobileTint: PREMIUM_ROSE,
  },
  {
    id: 'hall-designer',
    icon: FiLayout,
    iconBg: '#EFF6FF',
    iconColor: '#1D4ED8',
    title: 'Hall Layout Designer',
    desc: 'Design the physical bench layout for each exam hall. Place Small Benches (SB) and Big Benches (BB) on a grid. Used by the seating system with anti-copying rules.',
    chips: ['SB / BB Benches', 'Grid Editor'],
    chipColor: '#1D4ED8',
    chipBg: '#EFF6FF',
    chipBorder: '#93C5FD',
    btnLabel: 'Open Hall Designer',
    btnStyle: 'outline-blue',
    path: '/hall-designer',
    mobileLabel: 'Hall Designer',
    mobileTint: PREMIUM_ROSE,
  },
  {
    id: 'seating',
    icon: FiLayers,
    iconBg: '#FFFBEB',
    iconColor: '#92400E',
    title: 'Seating Allotment',
    desc: 'Generate bench-by-bench seating for any exam. Automatically detects when multiple years share the same hall and mixes students to prevent copying.',
    chips: ['Anti-Copying Rules', 'Multi-Year Mix', 'Print Ready'],
    chipColor: '#92400E',
    chipBg: '#FFFBEB',
    chipBorder: '#FCD34D',
    btnLabel: 'Go to Seating Allotment',
    btnStyle: 'outline-amber',
    path: '/seating-allotment',
    mobileLabel: 'Seating Allotment',
    mobileTint: PREMIUM_ROSE,
  },
  {
    id: 'history',
    icon: FiPrinter,
    iconBg: '#F5F3FF',
    iconColor: '#7C3AED',
    title: 'Allocation History',
    desc: 'View, edit and print all past exam hall allocations. Download hall plans as PDF, generate attendance sheets, and manage historical data.',
    chips: ['PDF Download', 'Edit & Reprint'],
    chipColor: '#7C3AED',
    chipBg: '#F5F3FF',
    chipBorder: '#C4B5FD',
    btnLabel: 'View History',
    btnStyle: 'outline-purple',
    path: '/history',
    mobileLabel: 'Allocation History',
    mobileTint: PREMIUM_ROSE,
  },
];

const btnStyles = {
  primary: {
    background: 'linear-gradient(135deg,#B42B6A 0%,#9A2259 100%)',
    color: 'white', border: 'none',
    boxShadow: '0 4px 14px rgba(180,43,106,0.30)',
  },
  'outline-pink':   { background: 'white', color: '#B42B6A', border: '2px solid #B42B6A' },
  'outline-blue':   { background: 'white', color: '#1D4ED8', border: '2px solid #1D4ED8' },
  'outline-amber':  { background: 'white', color: '#D97706', border: '2px solid #D97706' },
  'outline-green':  { background: 'white', color: '#15803D', border: '2px solid #15803D' },
  'outline-purple': { background: 'white', color: '#7C3AED', border: '2px solid #7C3AED' },
};

const hoverBgs = {
  'outline-pink':   '#FDF2F7',
  'outline-blue':   '#EFF6FF',
  'outline-amber':  '#FFFBEB',
  'outline-green':  '#F0FDF4',
  'outline-purple': '#F5F3FF',
};

const SHORTCUTS = [
  { label: 'Home',              icon: FiHome,     path: '/home' },
  { label: 'Attendance',        icon: FiClipboard, path: '/attendance' },
  { label: 'History',           icon: FiClock,    path: '/history' },
  { label: 'Designer',          icon: FiLayout,   path: '/hall-designer' },
  { label: 'Seating',           icon: FiLayers,   path: '/seating-allotment' },
];

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="page-enter home-page-wrap">

      {/* ── Hero — "Welcome to Hallocate" gradient text + soft pink glow ── */}
      <m.div
        className="home-welcome"
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="home-hero-glow" aria-hidden="true" />
        <TypingHeroTitle />
        <p className="home-welcome-subtitle">
          E-Exam Hall Allocation &middot; PSNA College of Engineering &amp; Technology, Dept. of CSE
        </p>
      </m.div>

      {/* ── Ultra-compact mobile launcher (mobile only — desktop/tablet keep the full cards below) ── */}
      <m.div
        className="home-mobile-launcher"
        variants={staggerContainer(0.04)}
        initial="hidden"
        animate="visible"
      >
        {CARDS.map((card) => (
          <m.button
            key={card.id}
            type="button"
            className="home-launcher-card"
            variants={fadeUp}
            style={{ background: card.mobileTint.bg, borderColor: card.mobileTint.border, color: card.mobileTint.text }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.18, ease: EASE }}
            onClick={() => navigate(card.path)}
          >
            {card.mobileLabel}
          </m.button>
        ))}
      </m.div>

      {/* ── Feature Cards Grid (desktop / tablet) ── */}
      <m.div
        className="home-cards-grid"
        variants={staggerContainer(0.07)}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
      >
        {CARDS.map((card) => {
          const Icon = card.icon;
          const bStyle = btnStyles[card.btnStyle];
          const hoverBg = hoverBgs[card.btnStyle];
          return (
            <m.div
              key={card.id}
              className="home-card"
              data-module={card.id}
              variants={fadeUp}
              whileHover={{ y: -6, scale: 1.02, transition: { duration: 0.25, ease: EASE } }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Icon */}
              <m.div
                className="home-card-icon"
                style={{ width: 52, height: 52, borderRadius: 14, background: card.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4, flexShrink: 0 }}
                whileHover={{ scale: 1.08 }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                <Icon size={24} color={card.iconColor} />
              </m.div>

              {/* Text */}
              <div style={{ flex: 1 }}>
                <h3 className="home-card-title">{card.title}</h3>
                <p className="home-card-desc">{card.desc}</p>
              </div>

              {/* Chips */}
              <div className="home-chip-row">
                {card.chips.map(chip => (
                  <span
                    key={chip}
                    className="home-chip"
                    style={{ fontSize: 11, fontWeight: 700, color: card.chipColor, background: card.chipBg, padding: '3px 10px', borderRadius: 50, border: `1px solid ${card.chipBorder}` }}
                  >
                    {chip}
                  </span>
                ))}
              </div>

              {/* Button */}
              <button
                className="home-card-btn"
                style={{ ...bStyle }}
                onClick={() => navigate(card.path)}
                onMouseEnter={e => {
                  if (card.btnStyle === 'primary') {
                    e.currentTarget.style.opacity = '0.9';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  } else {
                    e.currentTarget.style.background = hoverBg;
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.opacity = '1';
                  if (card.btnStyle !== 'primary') e.currentTarget.style.background = 'white';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {card.btnLabel} <FiArrowRight size={14} />
              </button>
            </m.div>
          );
        })}
      </m.div>

      {/* ── Bottom Utility Panel ── */}
      <m.div
        className="home-utility-panel"
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        {SHORTCUTS.map(({ label, icon: Icon, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="home-utility-item"
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </m.div>
    </div>
  );
};

export default Home;
