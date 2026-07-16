import SiteNav from './SiteNav';

/**
 * Header for all non-home pages. Renders the shared <SiteNav /> so the navbar is
 * identical across the whole site (full nav on desktop, hamburger + drawer on mobile).
 */
export default function SiteHeader() {
  return <SiteNav />;
}
