/** App icons for the email buttons on iPhone: Gmail (its multi-colour M), Outlook (white mark on its blue tile) and Apple Mail (white envelope on its blue tile). */
const TILE = { width: 48, height: 48, viewBox: "0 0 48 48", "aria-hidden": true, focusable: false } as const;

export function GmailIcon() {
  return (
    <svg {...TILE}>
      <rect width="48" height="48" rx="11" fill="#fff" stroke="#dadce0" />
      <svg x="8" y="12" width="32" height="24.1" viewBox="0 0 256 193">
        <path fill="#4285f4" d="M58.182 192.05V93.14L27.507 65.077L0 49.504v125.091c0 9.658 7.825 17.455 17.455 17.455z"/><path fill="#34a853" d="M197.818 192.05h40.727c9.659 0 17.455-7.826 17.455-17.455V49.505l-31.156 17.837l-27.026 25.798z"/><path fill="#ea4335" d="m58.182 93.14l-4.174-38.647l4.174-36.989L128 69.868l69.818-52.364l4.669 34.992l-4.669 40.644L128 145.504z"/><path fill="#fbbc04" d="M197.818 17.504V93.14L256 49.504V26.231c0-21.585-24.64-33.89-41.89-20.945z"/><path fill="#c5221f" d="m0 49.504l26.759 20.07L58.182 93.14V17.504L41.89 5.286C24.61-7.66 0 4.646 0 26.23z"/>
      </svg>
    </svg>
  );
}

export function OutlookIcon() {
  return (
    <svg {...TILE}>
      <defs><linearGradient id="ol-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1a6fd4" /><stop offset="1" stopColor="#0a4fb0" /></linearGradient></defs>
      <rect width="48" height="48" rx="11" fill="url(#ol-bg)" />
      <svg x="8.75" y="9" width="30" height="30" viewBox="0 0 24 24">
        <path fill="#fff" d="M7.88 12.04q0 .45-.11.87q-.1.41-.33.74q-.22.33-.58.52q-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55q-.22-.33-.33-.75q-.1-.42-.1-.86t.1-.87t.34-.76q.22-.34.59-.54q.36-.2.87-.2t.86.2q.35.21.57.55t.31.77q.1.43.1.88M24 12v9.38q0 .46-.33.8q-.33.32-.8.32H7.13q-.46 0-.8-.33q-.32-.33-.32-.8V18H1q-.41 0-.7-.3q-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75q.3-.3.75-.3h12.9q.44 0 .75.3q.3.3.3.75v8.3l1.24.72h.01q.1.07.18.18q.07.12.07.25m-6-8.25v3h3v-3zm0 4.5v3h3v-3zm0 4.5v1.83l3.05-1.83zm-5.25-9v3h3.75v-3zm0 4.5v3h3.75v-3zm0 4.5v2.03l2.41 1.5l1.34-.8v-2.73zM9 3.75V6h2l.13.01l.12.04v-2.3zM5.98 15.98q.9 0 1.6-.3q.7-.32 1.19-.86q.48-.55.73-1.28q.25-.74.25-1.61q0-.83-.25-1.55q-.24-.71-.71-1.24t-1.15-.83t-1.55-.3q-.92 0-1.64.3q-.71.3-1.2.85q-.5.54-.75 1.3q-.25.74-.25 1.63q0 .85.26 1.56q.26.72.74 1.23q.48.52 1.17.81q.69.3 1.56.3zM7.5 21h12.39L12 16.08V17q0 .41-.3.7q-.29.3-.7.3H7.5zm15-.13v-7.24l-5.9 3.54Z"/>
      </svg>
    </svg>
  );
}

export function AppleMailIcon() {
  return (
    <svg {...TILE}>
      <defs><linearGradient id="am-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1fb6fb" /><stop offset="1" stopColor="#1b6ff0" /></linearGradient></defs>
      <rect width="48" height="48" rx="11" fill="url(#am-bg)" />
      <rect x="9" y="13.5" width="30" height="21" rx="3.5" fill="#fff" />
      <path d="M10.5 16 24 26.5 37.5 16" fill="none" stroke="#1b6ff0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}
