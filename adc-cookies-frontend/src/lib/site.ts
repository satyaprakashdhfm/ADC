// Central contact / channel config so the WhatsApp number and brand details live in one place.

// Digits only, with country code — used to build wa.me links. (+91 88616 57617)
export const WHATSAPP_NUMBER = '918861657617';
export const SITE_PHONE = '+91 88616 57617';
export const SITE_EMAIL = 'info@adoughcookie.com';

/**
 * The registered company and its head office — the legal entity behind the a dough cookie brand.
 * Distinct from the shops in lib/stores.ts, which is where you buy a cookie; this is where post,
 * invoices and business correspondence go, and it is not a counter you can walk up to.
 */
export const COMPANY_NAME = 'Adora Foods';
export const HEAD_OFFICE = {
  address: '9th Main Rd, 2nd Block, Jaya Nagar East, Jayanagar, Bengaluru, Karnataka 560011',
  map: 'https://maps.app.goo.gl/9oM1hnxp57Y4CELA6',
};

// Real social profiles (launch): Instagram + YouTube + LinkedIn are shown site-wide.
export const INSTAGRAM_URL = 'https://www.instagram.com/adoughcookie?igsh=bjFwcnF1amVicXJj';
export const YOUTUBE_URL = 'https://youtube.com/@adoughcookies?si=1oE39EYWdQIf2rKI';
export const LINKEDIN_URL = 'https://www.linkedin.com/company/adough-cookie/';

/** Build a WhatsApp deep link with an optional pre-filled message. */
export function whatsappLink(message = "Hi a dough cookie! I'd like to order some fresh cookies.") {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
