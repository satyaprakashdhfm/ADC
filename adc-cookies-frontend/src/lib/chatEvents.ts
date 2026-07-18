// Lets any component (e.g. the footer's "FAQs" link) open the chatbot, which actually lives
// inside FloatingDock — a plain DOM event avoids wiring a global store just for this one button.
export const OPEN_CHAT_EVENT = 'adc:open-chat';

export function openChatbot() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_CHAT_EVENT));
}
