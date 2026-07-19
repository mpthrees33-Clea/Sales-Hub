/**
 * EmailProvider — Microsoft-Graph-shaped (delta query, draft objects) so
 * GraphEmailProvider is a drop-in swap later (docs/APPENDIX §4.1). The demo
 * implementation reads/writes the seeded tables and marks sent mail in-app
 * only. No agent holds a reference to this provider — only WO-03's approval
 * execution path calls createDraft/send.
 */
export type EmailMessage = {
  id: string;
  threadId: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  bodyText: string;
  receivedAt: Date;
  attachments: { name: string; contentType: string; blobKey: string; sizeBytes: number }[];
  isProcessed: boolean;
};

export type EmailThreadView = {
  id: string;
  subject: string;
  participants: string[];
  lastMessageAt: Date;
  status: string;
  messages: EmailMessage[];
};

export type OutboundDraft = {
  to: string[];
  cc?: string[];
  subject: string;
  bodyText: string;
  attachmentAssetIds?: string[];
  inReplyToEmailId?: string;
  threadId?: string;
};

export interface EmailProvider {
  /** Graph delta-query analogue: inbound messages newer than `since`, oldest first. */
  listNewMessages(since: Date): Promise<EmailMessage[]>;
  getThread(id: string): Promise<EmailThreadView>;
  /** Creates a draft object (Graph: POST /me/messages). Returns the draft id. */
  createDraft(draft: OutboundDraft): Promise<{ draftId: string; threadId: string }>;
  /** Sends a previously created draft (Graph: POST /me/messages/{id}/send). */
  send(draftId: string): Promise<{ sentEmailId: string }>;
}
