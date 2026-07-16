// Central contact / channel config so the WhatsApp number and brand details live in one place.

// Digits only, with country code — used to build wa.me links. (+91 93815 02998)
export const WHATSAPP_NUMBER = '919381502998';
export const SITE_PHONE = '+91 93815 02998';
export const SITE_EMAIL = 'satyaprakashreddy6789@gmail.com';

// Social handles — PLACEHOLDERS, swap for the real profiles before launch.
export const INSTAGRAM_URL = 'https://instagram.com/adoughcookie';
export const FACEBOOK_URL = 'https://facebook.com/adoughcookie';

/** Build a WhatsApp deep link with an optional pre-filled message. */
export function whatsappLink(message = "Hi a dough cookie! I'd like to order some fresh cookies.") {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
