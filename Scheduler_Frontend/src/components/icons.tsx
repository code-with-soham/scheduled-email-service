import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;
const base = (props: IconProps) => ({ width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...props });

export const SearchIcon = (p: IconProps) => <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>;
export const FilterIcon = (p: IconProps) => <svg {...base(p)}><path d="M4 5h16M7 12h10M10 19h4" /></svg>;
export const RefreshIcon = (p: IconProps) => <svg {...base(p)}><path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5" /></svg>;
export const ClockIcon = (p: IconProps) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>;
export const SendIcon = (p: IconProps) => <svg {...base(p)}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></svg>;
export const StarIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => <svg {...base(p)} fill={filled ? 'currentColor' : 'none'}><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" /></svg>;
export const ChevronDownIcon = (p: IconProps) => <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>;
export const ArchiveIcon = (p: IconProps) => <svg {...base(p)}><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 13h4" /></svg>;
export const TrashIcon = (p: IconProps) => <svg {...base(p)}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7" /></svg>;
export const BackArrowIcon = (p: IconProps) => <svg {...base(p)}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>;
export const PaperclipIcon = (p: IconProps) => <svg {...base(p)}><path d="M21.44 11.05 12.25 20.2a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95L10.13 17.1a2 2 0 0 1-2.83-2.83l8.49-8.49" /></svg>;
export const CalendarIcon = (p: IconProps) => <svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>;
export const UploadIcon = (p: IconProps) => <svg {...base(p)}><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>;
export const PlaneIcon = (p: IconProps) => <svg {...base(p)}><path d="m3 11 18-8-8 18-2-8-8-2Z" /></svg>;
export const CloseIcon = (p: IconProps) => <svg {...base(p)}><path d="M18 6 6 18M6 6l12 12" /></svg>;
export const GoogleIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg width="18" height="18" viewBox="0 0 48 48" {...p}>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5Z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 16 4 9.1 8.5 6.3 14.7Z" />
    <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.5 35.4 26.9 36 24 36c-5.2 0-9.7-3.3-11.3-8l-6.6 5.1C9 39.5 15.9 44 24 44Z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.6 5.4C41.6 35.8 44 30.3 44 24c0-1.3-.1-2.7-.4-3.5Z" />
  </svg>
);

/* rich-text toolbar icons */
export const UndoIcon = (p: IconProps) => <svg {...base(p)}><path d="M3 7v6h6M3 13a9 9 0 1 1 3 6.7" /></svg>;
export const RedoIcon = (p: IconProps) => <svg {...base(p)}><path d="M21 7v6h-6M21 13a9 9 0 1 0-3 6.7" /></svg>;
export const BoldIcon = (p: IconProps) => <svg {...base(p)}><path d="M6 4h7a3.5 3.5 0 0 1 0 7H6zM6 11h8a3.5 3.5 0 0 1 0 7H6z" /></svg>;
export const ItalicIcon = (p: IconProps) => <svg {...base(p)}><path d="M11 4h6M7 20h6M14 4 10 20" /></svg>;
export const UnderlineIcon = (p: IconProps) => <svg {...base(p)}><path d="M6 4v6a6 6 0 0 0 12 0V4M5 20h14" /></svg>;
export const StrikeIcon = (p: IconProps) => <svg {...base(p)}><path d="M5 12h14M8 6.5c.7-1 2-1.7 4-1.7 3 0 4.5 1.4 4.5 3.2 0 1.2-.6 2-1.7 2.6M7.5 17c.7 1.1 2.2 1.9 4.3 1.9 2.7 0 4.7-1 4.7-3" /></svg>;
export const AlignCenterIcon = (p: IconProps) => <svg {...base(p)}><path d="M6 6h12M4 12h16M7 18h10" /></svg>;
export const ExpandIcon = (p: IconProps) => <svg {...base(p)}><path d="m7 15 5 5 5-5M7 9l5-5 5 5" /></svg>;
export const OrderedListIcon = (p: IconProps) => <svg {...base(p)}><path d="M10 6h11M10 12h11M10 18h11M4 6h1v3M4 10h2M4 15c1-1 2-.5 2 .3 0 .6-.5.9-1 1.2h1.5" /></svg>;
export const UnorderedListIcon = (p: IconProps) => <svg {...base(p)}><path d="M10 6h11M10 12h11M10 18h11" /><circle cx="4.5" cy="6" r="1.3" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="none" /></svg>;
export const IndentIcon = (p: IconProps) => <svg {...base(p)}><path d="M3 6h18M3 18h18M11 12h10M3 9l5 3-5 3" /></svg>;
export const OutdentIcon = (p: IconProps) => <svg {...base(p)}><path d="M3 6h18M3 18h18M11 12h10M8 9 3 12l5 3" /></svg>;
export const QuoteIcon = (p: IconProps) => <svg {...base(p)}><path d="M7 8c-2 1-3 2.5-3 4.5S5.3 16 7.5 16 11 14 11 12c0-2-1.3-3.2-3-3.2M17 8c-2 1-3 2.5-3 4.5S15.3 16 17.5 16 21 14 21 12c0-2-1.3-3.2-3-3.2" /></svg>;
export const ParagraphIcon = (p: IconProps) => <svg {...base(p)}><path d="M12 5v14M9 5h7.5a3.5 3.5 0 1 1 0 7H12" /></svg>;
