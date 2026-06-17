import { whatsappLink } from '@/lib/site';

/**
 * Floating WhatsApp button, fixed to the bottom-right corner — the brand's preferred
 * "talk to us / order" channel (used in place of an Order Now CTA on the home page).
 */
export default function WhatsAppButton({ message }: { message?: string }) {
  return (
    <a
      href={whatsappLink(message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      style={{
        position: 'fixed', right: 22, bottom: 22, zIndex: 50,
        width: 62, height: 62, borderRadius: '50%',
        background: 'var(--whatsapp-green)',
        display: 'grid', placeItems: 'center',
        boxShadow: '0 12px 30px rgba(37,211,102,.45), 0 4px 10px rgba(0,0,0,.18)',
        textDecoration: 'none',
      }}
    >
      {/* Pulsing ring */}
      <span
        aria-hidden
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '2px solid rgba(37,211,102,.6)',
          animation: 'waPulse 2.4s ease-out infinite',
        }}
      />
      <svg width={34} height={34} viewBox="0 0 32 32" fill="#fff" aria-hidden>
        <path d="M16.003 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.26.6 4.46 1.74 6.4L3.2 28.8l6.56-1.72a12.74 12.74 0 0 0 6.24 1.6h.005c7.06 0 12.8-5.74 12.8-12.8s-5.745-12.68-12.8-12.68Zm0 23.04h-.004a10.6 10.6 0 0 1-5.4-1.48l-.388-.23-4.03 1.06 1.076-3.93-.252-.404a10.56 10.56 0 0 1-1.62-5.62c0-5.86 4.77-10.63 10.64-10.63 2.84 0 5.51 1.11 7.52 3.12a10.56 10.56 0 0 1 3.114 7.52c0 5.86-4.77 10.63-10.63 10.63Zm5.83-7.96c-.32-.16-1.89-.93-2.18-1.04-.29-.11-.5-.16-.71.16-.21.32-.82 1.04-1 1.25-.18.21-.37.24-.69.08-.32-.16-1.35-.5-2.57-1.58-.95-.85-1.59-1.9-1.78-2.22-.18-.32-.02-.49.14-.65.14-.14.32-.37.48-.55.16-.18.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.71-1.71-.97-2.34-.26-.62-.52-.54-.71-.55l-.6-.01c-.21 0-.55.08-.84.4-.29.32-1.1 1.08-1.1 2.63 0 1.55 1.13 3.05 1.29 3.26.16.21 2.22 3.39 5.38 4.76.75.32 1.34.51 1.8.66.76.24 1.45.21 1.99.13.61-.09 1.89-.77 2.16-1.52.27-.75.27-1.39.19-1.52-.08-.13-.29-.21-.61-.37Z" />
      </svg>
    </a>
  );
}
