import type { ReactNode } from "react";

function Icon({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const GearIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Icon>
);
export const BackIcon = () => (<Icon><path d="M15 18l-6-6 6-6" /></Icon>);
export const ChevronRight = ({ size = 20 }: { size?: number }) => (<Icon size={size}><path d="M9 18l6-6-6-6" /></Icon>);
export const ForwardIcon = () => (<Icon><path d="M9 18l6-6-6-6" /></Icon>);
export const HomeIcon = () => (<Icon><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></Icon>);
export const CalendarIcon = () => (<Icon><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M3 9h18M8 2v4M16 2v4" /></Icon>);
export const ChartIcon = () => (<Icon><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></Icon>);
export const PlusIcon = () => (<Icon size={20}><path d="M12 5v14M5 12h14" /></Icon>);
export const SlidersIcon = () => (<Icon><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></Icon>);
export const SaveIcon = () => (<Icon><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v6h7V3M8 21v-7h8v7" /></Icon>);
export const TableIcon = () => (<Icon><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 10h18M3 15h18M9 4v16" /></Icon>);
export const PieIcon = () => (<Icon><path d="M21 12A9 9 0 1 1 12 3v9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></Icon>);
export const DownloadIcon = () => (<Icon><path d="M12 3v12" /><path d="M7 11l5 5 5-5" /><path d="M5 21h14" /></Icon>);
export const ClockIcon = () => (<Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>);
export const ShieldIcon = () => (<Icon><path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" /></Icon>);
export const UsersIcon = () => (<Icon><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5" /><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.8c2 .6 3.2 2.3 3.5 5.2" /></Icon>);
export const FileIcon = () => (<Icon><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h7" /></Icon>);
export const MapPinIcon = () => (<Icon><path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></Icon>);
export const ChevronDown = () => (<Icon size={18}><path d="M6 9l6 6 6-6" /></Icon>);
export const ChevronUp = () => (<Icon size={18}><path d="M6 15l6-6 6 6" /></Icon>);
