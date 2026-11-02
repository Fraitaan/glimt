const paths = {
  heart: 'M12 20.5s-7.5-4.6-9.2-9.6C1.6 7.4 3.8 4 7.3 4c2 0 3.6 1.1 4.7 2.7C13.1 5.1 14.7 4 16.7 4c3.5 0 5.7 3.4 4.5 6.9-1.7 5-9.2 9.6-9.2 9.6Z',
  thumbDown: 'M10 15v4.5a2.5 2.5 0 0 0 2.5 2.5L17 13V3H6.6a2 2 0 0 0-2 1.7L3.3 12.7A2 2 0 0 0 5.3 15H10Z M17 3h2.5A1.5 1.5 0 0 1 21 4.5v7a1.5 1.5 0 0 1-1.5 1.5H17',
  bookmark: 'M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.5L5 21V4.5a1 1 0 0 1 1-1Z',
  soundOn: 'M4 9.5h3.5L12 5v14l-4.5-4.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z M15.5 9a4 4 0 0 1 0 6 M18.5 6.5a7.5 7.5 0 0 1 0 11',
  soundOff: 'M4 9.5h3.5L12 5v14l-4.5-4.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z M16 9.5l5 5 M21 9.5l-5 5',
  text: 'M5 5h14 M5 9.5h14 M5 14h14 M5 18.5h9',
  sources: 'M4 19.5V5a1.5 1.5 0 0 1 1.5-1.5H18a1 1 0 0 1 1 1V17H6a2 2 0 0 0-2 2.5Zm0 0A2 2 0 0 0 6 21.5h13 M8.5 8h6 M8.5 11.5h4',
  replay: 'M3.5 12a8.5 8.5 0 1 0 2.6-6.1 M3.5 4v4.5H8',
  play: 'M7 4.5v15a.8.8 0 0 0 1.2.7l12-7.5a.8.8 0 0 0 0-1.4l-12-7.5A.8.8 0 0 0 7 4.5Z',
  pause: 'M7 4.5h3v15H7z M14 4.5h3v15h-3z',
  chevronDown: 'M6 9.5l6 6 6-6',
  chevronUp: 'M6 14.5l6-6 6 6',
  chevronRight: 'M9.5 6l6 6-6 6',
  close: 'M6 6l12 12 M18 6L6 18',
  search: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z M20.5 20.5l-5-5',
  check: 'M4.5 12.5l5 5 10-11',
  spark: 'M12 2.5c.6 4.6 2.9 6.9 7.5 7.5-4.6.6-6.9 2.9-7.5 7.5-.6-4.6-2.9-6.9-7.5-7.5 4.6-.6 6.9-2.9 7.5-7.5Z M19 16c.3 2 1.2 3 3 3.2-1.8.3-2.7 1.2-3 3-.3-1.8-1.2-2.7-3-3 1.8-.2 2.7-1.2 3-3.2Z',
  compass: 'M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19Z M15.5 8.5l-2 5-5 2 2-5 5-2Z',
  sliders: 'M4 7h9 M17 7h3 M4 17h3 M11 17h9 M15 4.5v5 M9 14.5v5',
  info: 'M12 21.5a9.5 9.5 0 1 0 0-19 9.5 9.5 0 0 0 0 19Z M12 11v6 M12 7.5v.5',
  external: 'M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  trash: 'M4.5 6.5h15 M9.5 6.5V4.5h5v2 M6.5 6.5l1 13h9l1-13',
  download: 'M12 4v11 M7.5 10.5L12 15l4.5-4.5 M4.5 19.5h15',
  upload: 'M12 15V4 M7.5 8.5L12 4l4.5 4.5 M4.5 19.5h15',
  plus: 'M12 5v14 M5 12h14',
  copy: 'M9 9h10.5v10.5H9z M15 9V4.5H4.5V15H9',
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 24, filled = false, className = '' }: { name: IconName; size?: number; filled?: boolean; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={paths[name]} />
    </svg>
  )
}
