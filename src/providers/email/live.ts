import type { EmailMessage, EmailProvider, EmailThreadView, OutboundDraft } from "./types";

/**
 * Microsoft Graph implementation — the documented production path
 * (docs/APPENDIX §4.1: Entra app registration, delegated Mail.Read /
 * Mail.ReadWrite / Calendars.Read, delta queries). Deliberately not wired in
 * the demo (docs/00 §7): flaky OAuth on camera kills videos.
 */
export class GraphEmailProvider implements EmailProvider {
  listNewMessages(_since: Date): Promise<EmailMessage[]> {
    throw new Error(
      "GraphEmailProvider is the documented production path and is not wired in the demo. " +
        "Set DEMO_MODE=true, or implement the Graph swap per docs/APPENDIX-recommendations.md §4.",
    );
  }
  getThread(_id: string): Promise<EmailThreadView> {
    throw new Error("GraphEmailProvider not wired in demo — see docs/APPENDIX-recommendations.md §4");
  }
  createDraft(_draft: OutboundDraft): Promise<{ draftId: string; threadId: string }> {
    throw new Error("GraphEmailProvider not wired in demo — see docs/APPENDIX-recommendations.md §4");
  }
  send(_draftId: string): Promise<{ sentEmailId: string }> {
    throw new Error("GraphEmailProvider not wired in demo — see docs/APPENDIX-recommendations.md §4");
  }
}
