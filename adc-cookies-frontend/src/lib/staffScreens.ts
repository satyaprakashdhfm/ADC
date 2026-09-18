/**
 * The back office (/admin) and the shop counters' tablets (/store/<code>).
 *
 * Neither is a customer, so neither is tracked: an office that refreshes the dashboard all day would
 * otherwise be the site's most engaged "visitor", and the ads would be trained on it.
 */
export function isStaffScreen(pathname: string | null | undefined): boolean {
  const p = pathname || '';
  return p === '/admin' || p.startsWith('/admin/') || p === '/store' || p.startsWith('/store/');
}
