/*
 * WhatsApp support inbox: the shapes the backend returns (services/support/inbox.service.ts) and
 * the one interface both the store portal and the admin dashboard implement. The chat components
 * take a SupportApi and never know which credential is behind it.
 */
export interface SupportTicketRef { id: number; subject: string; status: string; orderNumber: string | null }

export interface SupportConversation {
  id: number;
  name: string;
  phone: string;
  linkedAccount: boolean;
  preview: string;
  lastMessageAt: string | null;
  unread: number;
  /** BOT: Doughie answers. HUMAN: a person has it and the bot is quiet. */
  mode: 'BOT' | 'HUMAN';
  status: 'OPEN' | 'CLOSED';
  needsHuman: boolean;
  needsHumanReason: string | null;
  takenBy: string | null;
  /** Meta's 24-hour window. Closed: a reply is held and the customer gets a notice to open it. */
  windowOpen: boolean;
  storeCode: string | null;
  ticket: SupportTicketRef | null;
}

export type SupportSender = 'customer' | 'bot' | 'store' | 'admin' | 'system';

export interface SupportMessage {
  id: number;
  direction: 'in' | 'out';
  sender: SupportSender;
  senderName: string | null;
  body: string | null;
  mediaType: string | null;
  mediaId: string | null;
  /** received · sent · delivered · read · failed · held */
  status: string;
  error: string | null;
  createdAt: string;
}

export interface SupportTicketNote { source: string; author: string | null; body: string; createdAt: string }

export interface SupportThread {
  conversation: SupportConversation;
  messages: SupportMessage[];
  ticketNotes: SupportTicketNote[];
}

export interface SupportSummary { unreadChats: number; needsHuman: number; latestCustomerAt: string | null }

export interface SupportApi {
  summary(): Promise<SupportSummary>;
  list(): Promise<SupportConversation[]>;
  open(id: number): Promise<SupportThread>;
  reply(id: number, text: string): Promise<{ ok: boolean; held?: boolean }>;
  take(id: number): Promise<unknown>;
  release(id: number): Promise<unknown>;
  close(id: number, resolveTicket: boolean): Promise<unknown>;
  /** A customer's photo or file as an object URL, fetched with this side's credential. */
  mediaUrl(mediaId: string): Promise<string>;
}
