import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 22): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
});

export const IconHome = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></svg>);
export const IconDumbbell = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11" /></svg>);
export const IconCalendar = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>);
export const IconChart = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 19h16" /><path d="m5 15 4.5-5 3.5 3 6-7" /></svg>);
export const IconGear = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>);
export const IconPlus = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>);
export const IconCheck = ({ size, ...p }: P) => (<svg {...base(size)} strokeWidth={2.6} {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
export const IconX = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const IconChevron = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="m9 6 6 6-6 6" /></svg>);
export const IconBack = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="m15 6-6 6 6 6" /></svg>);
export const IconDots = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="19" cy="12" r="1.3" fill="currentColor" /></svg>);
export const IconTimer = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.5v4l2.5 2M9.5 2.5h5" /></svg>);
export const IconTrash = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" /></svg>);
export const IconSearch = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>);
export const IconUp = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="m6 15 6-6 6 6" /></svg>);
export const IconDown = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="m6 9 6 6 6-6" /></svg>);
export const IconLink = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>);
export const IconNote = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M5 4h10l4 4v12H5z" /><path d="M9 12h6M9 16h4" /></svg>);
export const IconTrophy = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0zM12 13v4M8.5 20h7M16 6h3v1.5a3 3 0 0 1-3 3M8 6H5v1.5a3 3 0 0 0 3 3" /></svg>);
export const IconFlame = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M12 21c4 0 6.5-2.6 6.5-6.2 0-3.6-3-6-4-9.3-2 1.6-2.6 3.5-2.6 5-1-.8-1.6-2-1.7-3.2C8 9 5.5 11.6 5.5 14.8 5.5 18.4 8 21 12 21Z" /></svg>);
export const IconEdit = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>);
export const IconCopy = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>);
