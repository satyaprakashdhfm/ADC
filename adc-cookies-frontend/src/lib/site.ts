// Central contact / channel config so the WhatsApp number and brand details live in one place.

// Digits only, with country code — used to build wa.me links. (+91 93815 02998)
export const WHATSAPP_NUMBER = '919381502998';
export const SITE_PHONE = '+91 93815 02998';
export const SITE_EMAIL = 'satyaprakashreddy6789@gmail.com';

// Real social profiles (launch): only Instagram + YouTube are shown site-wide.
export const INSTAGRAM_URL = 'https://www.instagram.com/adoughcookie?igsh=bjFwcnF1amVicXJj';
export const YOUTUBE_URL = 'https://youtube.com/@adoughcookies?si=1oE39EYWdQIf2rKI';

/** Build a WhatsApp deep link with an optional pre-filled message. */
export function whatsappLink(message = "Hi a dough cookie! I'd like to order some fresh cookies.") {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
