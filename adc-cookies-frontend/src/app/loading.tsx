import MascotLoader from '@/components/MascotLoader';

// Shown by Next.js while a route segment is loading. The `delay` keeps it hidden for
// the first ~0.8s so quick navigations don't flash a loader.
export default function Loading() {
  return <MascotLoader fullscreen delay label="Just a moment…" />;
}
