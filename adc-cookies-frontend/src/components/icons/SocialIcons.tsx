/**
 * Social glyphs for the footer.
 *
 * Hand-rolled because this version of lucide dropped brand icons — there is no Instagram/YouTube/
 * LinkedIn to import, and WhatsApp never existed there. All four take a `size` and paint with
 * `currentColor`, so the footer's white-on-orange treatment needs no per-icon colour.
 *
 * Instagram is drawn as strokes (its glyph IS an outline), the rest as solid fills, which is how
 * each brand's own mark reads at 20px.
 */
type IconProps = { size?: number } & React.SVGProps<SVGSVGElement>;

const base = (size: number) => ({
  width: size, height: size, viewBox: '0 0 24 24',
  'aria-hidden': true as const, focusable: 'false' as const,
});

export function WhatsAppIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg {...base(size)} viewBox="0 0 32 32" fill="currentColor" {...rest}>
      <path d="M16.003 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.26.6 4.46 1.74 6.4L3.2 28.8l6.56-1.72a12.74 12.74 0 0 0 6.24 1.6h.005c7.06 0 12.8-5.74 12.8-12.8s-5.745-12.68-12.8-12.68Zm0 23.04h-.004a10.6 10.6 0 0 1-5.4-1.48l-.388-.23-4.03 1.06 1.076-3.93-.252-.404a10.56 10.56 0 0 1-1.62-5.62c0-5.86 4.77-10.63 10.64-10.63 2.84 0 5.51 1.11 7.52 3.12a10.56 10.56 0 0 1 3.114 7.52c0 5.86-4.77 10.63-10.63 10.63Zm5.83-7.96c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1 1.25-.18.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.58-.95-.85-1.59-1.9-1.78-2.22-.18-.32-.02-.49.14-.65.14-.14.32-.37.48-.55.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.71-.97-2.34-.26-.62-.52-.54-.71-.55l-.6-.01c-.21 0-.55.08-.84.4-.29.32-1.1 1.08-1.1 2.63 0 1.55 1.13 3.05 1.29 3.26.16.21 2.22 3.39 5.38 4.76.75.32 1.34.51 1.8.66.76.24 1.45.21 1.99.13.61-.09 1.89-.77 2.16-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z" />
    </svg>
  );
}

export function InstagramIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg {...base(size)} fill="none" stroke="currentColor" strokeWidth="1.9" {...rest}>
      <rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5.4" />
      <circle cx="12" cy="12" r="4.4" />
      {/* The lens highlight is a filled dot, not a ring — a stroked circle this small fills in anyway. */}
      <circle cx="17.6" cy="6.4" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function YouTubeIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg {...base(size)} fill="currentColor" {...rest}>
      {/* One path, evenodd, so the play triangle is knocked out of the rounded plate — that way the
          triangle shows the footer behind it rather than being painted a second colour. */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M21.6 7.2a2.78 2.78 0 0 0-1.96-1.96C17.9 4.75 12 4.75 12 4.75s-5.9 0-7.64.49A2.78 2.78 0 0 0 2.4 7.2C1.95 8.94 1.95 12 1.95 12s0 3.06.45 4.8a2.78 2.78 0 0 0 1.96 1.96c1.74.49 7.64.49 7.64.49s5.9 0 7.64-.49a2.78 2.78 0 0 0 1.96-1.96c.45-1.74.45-4.8.45-4.8s0-3.06-.45-4.8ZM10.05 15.3V8.7L15.75 12l-5.7 3.3Z"
      />
    </svg>
  );
}

export function LinkedInIcon({ size = 20, ...rest }: IconProps) {
  return (
    <svg {...base(size)} fill="currentColor" {...rest}>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.44-2.14 2.94v5.67H9.35V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13ZM7.12 20.45H3.55V9h3.57v11.45Z" />
    </svg>
  );
}
