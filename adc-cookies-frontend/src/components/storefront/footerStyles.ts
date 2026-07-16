/* Shared footer styles — kept in a plain module so both the server Footer and the
 * client FooterCookies can import them without crossing a component boundary. */

export const footerHeadingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  color: 'var(--white)',
  marginBottom: 14,
  fontSize: 'var(--text-lg)',
  letterSpacing: '-0.01em',
};

export const footerLinkStyle: React.CSSProperties = {
  color: 'var(--white-82)',
  textDecoration: 'none',
  fontSize: 'var(--text-sm)',
  lineHeight: 1.35,
  width: 'fit-content',
  transition: 'color .15s ease',
};
