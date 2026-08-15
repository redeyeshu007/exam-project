/* ── Shared motion language ──────────────────────────────
   One consistent timing/easing system used across the app.
   Small = micro-interactions, Medium = card/element transitions,
   Large = page/route transitions. */

export const EASE = [0.22, 1, 0.36, 1];

export const DURATION = {
  small: 0.18,
  medium: 0.3,
  large: 0.6,
};

export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.medium, ease: EASE } },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.medium, ease: EASE } },
};

export const staggerContainer = (staggerDelay = 0.06, delayChildren = 0) => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: staggerDelay, delayChildren },
  },
});

export const pageTransition = {
  initial: { opacity: 0, scale: 0.98, y: 8, filter: 'blur(4px)' },
  animate: { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 0.98, y: -8, filter: 'blur(4px)' },
  transition: { duration: 0.6, ease: EASE },
};
