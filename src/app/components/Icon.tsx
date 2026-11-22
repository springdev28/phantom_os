import type { CSSProperties } from 'react';

const paths = {
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  inspect: 'M13 3H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V10L13 3zm0 0v7h7M8 14h8m-8 3h5',
  compatibility: 'M4 6h16M4 18h16M8 3v6m8 6v6M4 12h16m-4-3v6',
  configure: 'M4 6h16M4 18h16M8 3v6m8 6v6M4 12h16m-4-3v6',
  player: 'M4 4h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm4 17h8m-4-3v3m-2-14 6 4-6 4z',
  workspace: 'M3 7h7l2-3h8a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7zm0 0V5a1 1 0 0 1 1-1h5l3 3h9',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  chevron: 'm9 5 7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M6 18 18 6',
  check: 'm5 12 4 4L19 6',
  shield: 'm12 3 8 3v6c0 4-5 8-8 9-3-1-8-5-8-9V6zm-4 9 3 3 5-6',
  info: 'M12 11v6m0-10v.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3',
  circle: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d={paths[name]} />
  </svg>;
}
