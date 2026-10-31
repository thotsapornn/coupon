import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  };
}

export function TicketIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M3 8.5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.2a2.3 2.3 0 0 0 0 4.6v1.2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.2a2.3 2.3 0 0 0 0-4.6Z" />
      <path d="M15 6.5v11" strokeDasharray="2 2.4" />
    </svg>
  );
}

export function PlusIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function SearchIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function QrIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
      <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
      <path d="M14.5 14.5h3v3h-3zM20.5 14.5v6h-6" />
    </svg>
  );
}

export function CheckIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function CheckCircleIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

export function UndoIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M9 7 4.5 11.5 9 16" />
      <path d="M4.5 11.5H14a5 5 0 0 1 0 10h-2" />
    </svg>
  );
}

export function PencilIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5Z" />
      <path d="m13.5 7 3.5 3.5" />
    </svg>
  );
}

export function TrashIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.2A1.8 1.8 0 0 0 9.1 21h5.8a1.8 1.8 0 0 0 1.8-1.8L17.5 7" />
      <path d="M10.5 11v6M13.5 11v6" />
    </svg>
  );
}

export function ArrowLeftIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function UploadIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M12 16V4.5M7.5 9 12 4.5 16.5 9" />
      <path d="M4.5 15v3A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-3" />
    </svg>
  );
}

export function ClockIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function HistoryIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3.5 8.5" />
      <path d="M3.5 4.5v4h4" />
      <path d="M12 8v4.5l3 1.8" />
    </svg>
  );
}

export function AlertIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M12 4 2.8 20h18.4Z" />
      <path d="M12 9.5v4.5M12 17.2v.2" />
    </svg>
  );
}

export function InfoIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5V17M12 7.3v.2" />
    </svg>
  );
}

export function CopyIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 5.5v-1a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

export function SparklesIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9Z" />
      <path d="M18.5 16.5 19.3 19l2.4.8-2.4.8-.8 2.4-.8-2.4-2.4-.8 2.4-.8Z" />
    </svg>
  );
}

export function CameraIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M4.5 8.5h2.7l1.4-2.2h6.8l1.4 2.2h2.7A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18v-8a1.5 1.5 0 0 1 1.5-1.5Z" />
      <circle cx="12" cy="13.7" r="3.4" />
    </svg>
  );
}

export function XIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function ExpandIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </svg>
  );
}

export function ShareIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="6" r="2.6" />
      <circle cx="18" cy="18" r="2.6" />
      <path d="m8.4 10.8 7.2-3.6M8.4 13.2l7.2 3.6" />
    </svg>
  );
}

export function GridIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1" />
    </svg>
  );
}

export function ListIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M8.5 6h11M8.5 12h11M8.5 18h11" />
      <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" strokeWidth="2.6" />
    </svg>
  );
}

export function ShieldIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...base({ size, ...props })}>
      <path d="M12 3.5 5 6.3v5c0 4.2 2.9 7.5 7 9.2 4.1-1.7 7-5 7-9.2v-5Z" />
      <path d="m9 12 2 2 4-4.5" />
    </svg>
  );
}
