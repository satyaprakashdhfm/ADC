/**
 * "Track order" mark — two map pins joined by a dashed trail (origin → destination).
 *
 * Replaces lucide's PackageSearch (a parcel with a magnifying glass), which read as "search for a
 * box" rather than "where is my order right now". Drawn here rather than shipped as a PNG so it
 * inherits `currentColor` — the header is white-on-brand, and a black raster would have needed the
 * same `brightness(0) invert(1)` filter hack the logo uses — and so it stays crisp at any size.
 *
 * Traced from the reference art, then re-proportioned for the size it actually renders at. The
 * original is stroked at ~0.56 units on a 24 grid, which vanishes at 20px; at a legible 1.2 the
 * pins have to grow, or the inner ring closes up against the bulb and each pin turns into a blob.
 * The rings are also centred here rather than sitting slightly high as in the original, which at
 * this weight would collide with the top of the bulb. Kept from the reference: the 1.82
 * tip-length-to-radius ratio, the smaller-then-larger pin pairing, and the sweep of the trail.
 *
 * Takes the same `size` prop as the lucide icons beside it, so it drops into their call sites
 * unchanged.
 */
export function RouteTrackIcon({ size = 20, ...rest }: { size?: number } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {/* Origin pin. Each teardrop is its bulb arc taken the long way over the top, then straight
          tangent lines down to the point — the sharp tip is a mitred join, so leave linejoin alone. */}
      <path d="M2.68 7.48 A3.25 3.25 0 1 1 8.12 7.48 L5.4 11.62 Z" />
      <circle cx="5.4" cy="5.7" r="1.35" />

      {/* The trail, running tip to tip. Longer gaps than the reference on purpose: at 20px this
          pattern is about a pixel, and any tighter closes up into a solid line. */}
      <path
        d="M6.15 11.95 C10.98 12.91 12.13 20.36 17.3 21"
        strokeLinecap="round"
        strokeDasharray="0.5 2.3"
      />

      {/* Destination pin — the larger of the two, as the nearer one. */}
      <path d="M15.13 16.27 A3.67 3.67 0 1 1 21.27 16.27 L18.2 20.93 Z" />
      <circle cx="18.2" cy="14.25" r="1.6" />
    </svg>
  );
}
