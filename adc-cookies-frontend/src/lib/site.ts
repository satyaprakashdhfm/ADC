// Central contact / channel config so the WhatsApp number and brand details live in one place.

// Digits only, with country code — used to build wa.me links. (+91 88616 57617)
export const WHATSAPP_NUMBER = '918861657617';
export const SITE_PHONE = '+91 88616 57617';
export const SITE_EMAIL = 'info@adoughcookie.com';

/**
 * The registered firm behind the a dough cookie brand, and its office.
 *
 * Distinct from the shops in lib/stores.ts, which is where you buy a cookie; this is the legal
 * entity, and its address is the registered office — where post, invoices and correspondence go,
 * not a counter you can walk up to.
 *
 * Spelling is from the GST registration certificate: ADOORA, two Os. It reads like a typo and is
 * not one, so it is worth leaving this note for whoever "corrects" it later.
 *
 * A partnership firm has no CIN — that is a Companies Act registration and does not apply here.
 * The GSTIN is the identifier to quote.
 */
export const COMPANY_NAME = 'Adoora Foods';
export const COMPANY_CONSTITUTION = 'a registered partnership firm';
export const COMPANY_GSTIN = '29ACCFA9095K1ZS';
export const HEAD_OFFICE = {
  address: '9th Main Rd, 2nd Block, Jaya Nagar East, Jayanagar, Bengaluru, Karnataka 560011',
  map: 'https://maps.app.goo.gl/9oM1hnxp57Y4CELA6',
  // Geocoded from the street address, not surveyed — right road and block, possibly a few doors
  // out. The map link above is the authoritative answer and the pin popup carries it.
  lat: 12.939212,
  lng: 77.5838982,
};

// Real social profiles (launch): Instagram + YouTube + LinkedIn are shown site-wide.
export const INSTAGRAM_URL = 'https://www.instagram.com/adoughcookie?igsh=bjFwcnF1amVicXJj';
export const YOUTUBE_URL = 'https://youtube.com/@adoughcookies?si=1oE39EYWdQIf2rKI';
export const LINKEDIN_URL = 'https://www.linkedin.com/company/adough-cookie/';

/** Build a WhatsApp deep link with an optional pre-filled message. */
export function whatsappLink(message = "Hi a dough cookie! I'd like to order some fresh cookies.") {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
