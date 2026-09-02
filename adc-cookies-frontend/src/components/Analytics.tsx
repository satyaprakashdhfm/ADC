'use client';
import Script from 'next/script';
import { GA_ID, ADS_ID, analyticsEnabled } from '@/lib/analytics';

/*
 * Loads gtag.js, once, for whichever Google properties are configured.
 *
 * Renders NOTHING when neither id is set, so an unconfigured deploy ships no third-party script at
 * all — no request, no cookie, no consent question to answer. That is why this can go live before
 * the Google accounts exist.
 *
 * afterInteractive, not beforeInteractive: analytics must never sit in front of the page a customer
 * is trying to read. It costs a few hundred milliseconds of attribution and buys the storefront its
 * first paint, which is the trade every Core Web Vitals score is made of.
 */
export default function Analytics() {
  if (!analyticsEnabled) return null;
  const primary = GA_ID || ADS_ID;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${primary}`} strategy="afterInteractive" />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          ${GA_ID ? `gtag('config', '${GA_ID}');` : ''}
          ${ADS_ID ? `gtag('config', '${ADS_ID}');` : ''}
        `}
      </Script>
    </>
  );
}
