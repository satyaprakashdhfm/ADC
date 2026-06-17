// Central contact / channel config so the WhatsApp number and brand details live in one place.

// Digits only, with country code — used to build wa.me links. (+91 98765 43210)
export const WHATSAPP_NUMBER = '919876543210';
export const SITE_PHONE = '+91 98765 43210';
export const SITE_EMAIL = 'hello@adccookies.com';

/** Build a WhatsApp deep link with an optional pre-filled message. */
export function whatsappLink(message = "Hi a dough cookie! I'd like to order some fresh cookies.") {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
