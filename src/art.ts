// Inline SVG art. Everything uses currentColor so CSS sets the palette.

export const GEM = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12l4 6-10 11L2 10z" fill="currentColor"/><path d="M2 10h20L12 21z" fill="#000" opacity=".22"/><path d="M6 4l3 6h6l3-6" fill="#fff" opacity=".28"/><path d="M9 10l3 11 3-11" fill="#fff" opacity=".12"/><path d="M8 6.5l1.5 2" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".9"/></svg>`;

export const GEM_OUTLINE = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M6 4h12l4 6-10 11L2 10z"/></svg>`;

export const BOMB = `<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="#120806" stroke-width="2.2" stroke-linecap="round"><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4M4.6 4.6l2.8 2.8M16.6 16.6l2.8 2.8M4.6 19.4l2.8-2.8M16.6 7.4l2.8-2.8"/></g><circle cx="12" cy="12" r="7" fill="#120806"/><circle cx="12" cy="12" r="2.6" fill="#ff5b37"/><circle cx="9.4" cy="9.2" r="1.6" fill="#fff" opacity=".55"/></svg>`;

export const FLAG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v18" stroke="#d9cbb8" stroke-width="2" stroke-linecap="round"/><path d="M7 3.5l12 4.5-12 4.5z" fill="#ff5b37"/><path d="M7 3.5l12 4.5-12 1z" fill="#fff" opacity=".2"/><ellipse cx="6" cy="21" rx="3.5" ry="1.2" fill="#000" opacity=".35"/></svg>`;

export const COIN = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12l4 6-10 11L2 10z" fill="currentColor"/></svg>`;

export const CRYSTAL = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l6 8-6 14-6-14z" fill="currentColor"/><path d="M12 1l6 8H6z" fill="#fff" opacity=".3"/></svg>`;

const stroke = (d: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

export const UPGRADE_ICONS: Record<string, string> = {
  // in-run
  richSoil: stroke('<path d="M12 21v-8"/><path d="M12 13c0-4 3-6 7-6 0 4-3 6-7 6z"/><path d="M12 15c0-3-2-5-6-5 0 3 2 5 6 5z"/><path d="M4 21h16"/>'),
  expand: stroke('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="9" y="9" width="6" height="6" rx="1"/>'),
  deepVeins: stroke('<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 12l9 4 9-4"/><path d="M3 17l9 4 9-4"/>'),
  detector: stroke('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6-6"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  autoHarvest: stroke('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
  shield: stroke('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  surveyor: stroke('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/><path d="M10.5 7.5v6M7.5 10.5h6"/>'),
  // meta
  headStart: stroke('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>'),
  safetyNet: stroke('<path d="M3 6c3 2 15 2 18 0"/><path d="M4 6l4 13M20 6l-4 13M12 7v13M3 12c4 2 14 2 18 0M5 17c4 1.5 10 1.5 14 0"/>'),
  steadyGround: stroke('<path d="M2 20l7-12 4 6 3-4 6 10z"/>'),
  biggerClaim: stroke('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>'),
  goldenTouch: stroke('<path d="M12 2l2.6 6.2L21 9l-5 4.4L17.5 20 12 16.8 6.5 20 8 13.4 3 9l6.4-.8z"/>'),
  coolHead: stroke('<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2"/>'),
  prospector: stroke('<path d="M9 3h6l1 4H8z"/><rect x="7" y="7" width="10" height="11" rx="2"/><path d="M12 10v5M10 21h4"/>'),
  unlockDetector: stroke('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/>'),
};
UPGRADE_ICONS.unlockAuto = UPGRADE_ICONS.unlockDetector;
UPGRADE_ICONS.unlockShield = UPGRADE_ICONS.unlockDetector;
UPGRADE_ICONS.unlockSurveyor = UPGRADE_ICONS.unlockDetector;
