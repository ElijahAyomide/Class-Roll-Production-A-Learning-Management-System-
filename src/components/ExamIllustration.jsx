import React from 'react';

// A custom illustration (not a photo) so there's no licensing/external-asset
// dependency — it's built from the app's own CSS variables, so it re-themes
// automatically if the color palette ever changes.
export default function ExamIllustration() {
  return (
    <svg viewBox="0 0 480 380" fill="none" xmlns="http://www.w3.org/2000/svg" className="exam-illustration">
      {/* Decorative floating dots */}
      <circle cx="46" cy="60" r="4" fill="#FFFFFF" opacity="0.25" />
      <circle cx="430" cy="90" r="5" fill="#FFFFFF" opacity="0.2" />
      <circle cx="60" cy="300" r="3" fill="#FFFFFF" opacity="0.25" />
      <circle cx="410" cy="320" r="4" fill="#FFFFFF" opacity="0.2" />
      <circle cx="240" cy="30" r="3" fill="#FFFFFF" opacity="0.2" />

      {/* Desk surface */}
      <rect x="30" y="300" width="420" height="10" rx="3" fill="#FFFFFF" opacity="0.12" />

      {/* --- Left, smaller monitor (background student) --- */}
      <g opacity="0.55">
        <rect x="52" y="150" width="110" height="82" rx="6" fill="#FFFFFF" />
        <rect x="60" y="158" width="94" height="16" rx="3" fill="var(--accent-purple)" />
        <rect x="60" y="182" width="70" height="5" rx="2.5" fill="var(--line)" />
        <rect x="60" y="192" width="80" height="5" rx="2.5" fill="var(--line)" />
        <rect x="60" y="202" width="55" height="5" rx="2.5" fill="var(--line)" />
        <rect x="98" y="232" width="16" height="14" fill="#FFFFFF" />
        <rect x="82" y="246" width="48" height="6" rx="3" fill="#FFFFFF" />
      </g>

      {/* --- Right, smaller monitor (background student) --- */}
      <g opacity="0.55">
        <rect x="318" y="150" width="110" height="82" rx="6" fill="#FFFFFF" />
        <rect x="326" y="158" width="94" height="16" rx="3" fill="var(--accent-purple)" />
        <rect x="326" y="182" width="60" height="5" rx="2.5" fill="var(--line)" />
        <rect x="326" y="192" width="75" height="5" rx="2.5" fill="var(--line)" />
        <rect x="326" y="202" width="50" height="5" rx="2.5" fill="var(--line)" />
        <rect x="365" y="232" width="16" height="14" fill="#FFFFFF" />
        <rect x="349" y="246" width="48" height="6" rx="3" fill="#FFFFFF" />
      </g>

      {/* --- Center, main monitor --- */}
      <rect x="150" y="96" width="180" height="132" rx="8" fill="#FFFFFF" />
      {/* screen header bar */}
      <rect x="162" y="108" width="156" height="20" rx="4" fill="var(--primary)" />
      <circle cx="174" cy="118" r="3.5" fill="#FFFFFF" opacity="0.8" />
      <rect x="184" y="115" width="60" height="6" rx="3" fill="#FFFFFF" opacity="0.8" />
      {/* question lines */}
      <rect x="162" y="138" width="130" height="6" rx="3" fill="var(--ink)" opacity="0.7" />
      <rect x="162" y="150" width="100" height="6" rx="3" fill="var(--line)" />
      {/* answer options */}
      <circle cx="168" cy="168" r="5" fill="#FFFFFF" stroke="var(--line)" strokeWidth="1.5" />
      <rect x="180" y="165" width="90" height="5" rx="2.5" fill="var(--line)" />
      <circle cx="168" cy="182" r="5" fill="var(--green)" />
      <path d="M165.5 182l1.8 1.8 3.2-3.6" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="180" y="179" width="100" height="5" rx="2.5" fill="var(--line)" />
      <circle cx="168" cy="196" r="5" fill="#FFFFFF" stroke="var(--line)" strokeWidth="1.5" />
      <rect x="180" y="193" width="80" height="5" rx="2.5" fill="var(--line)" />
      {/* progress bar */}
      <rect x="162" y="212" width="156" height="6" rx="3" fill="var(--surface-2)" />
      <rect x="162" y="212" width="98" height="6" rx="3" fill="var(--primary)" />
      {/* monitor stand */}
      <rect x="228" y="228" width="24" height="16" fill="#FFFFFF" />
      <rect x="204" y="244" width="72" height="8" rx="4" fill="#FFFFFF" />

      {/* Student silhouette seated at the center monitor */}
      <circle cx="240" cy="272" r="16" fill="var(--primary-dark)" />
      <path d="M204 320c0-22 16-36 36-36s36 14 36 36" fill="var(--primary-dark)" />

      {/* Clock badge, top right — timed exam */}
      <circle cx="404" cy="70" r="26" fill="#FFFFFF" />
      <circle cx="404" cy="70" r="20" fill="none" stroke="var(--line)" strokeWidth="2" />
      <path d="M404 58v12l9 6" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Checkmark badge, near left monitor — completed/graded */}
      <circle cx="120" cy="120" r="16" fill="var(--green)" />
      <path d="M113 120l5 5 10-11" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
