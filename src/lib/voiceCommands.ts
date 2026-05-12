import { useAppStore } from '../store/useAppStore';
import { drafts as draftsService } from '../services/email';
import { regenerateDraft } from './autoDraft';

// Page-aware voice command router. Sits in front of the default assistant —
// when the rep is on a page that has its own command vocabulary (today:
// /email), patterns matching that vocabulary handle the request directly.
// Anything that doesn't match falls through to the regular assistant engine.
//
// All commands return a string (spoken back via TTS) on success, or null when
// the input wasn't a recognized command for this page.

export interface VoiceContext {
  pathname: string;
}

export async function tryPageVoiceCommand(
  text: string,
  ctx: VoiceContext,
): Promise<string | null> {
  const t = text.trim();
  if (!t) return null;
  if (ctx.pathname === '/email') return tryEmailCommand(t);
  return null;
}

// ── /email commands ─────────────────────────────────────────
async function tryEmailCommand(text: string): Promise<string | null> {
  const state = useAppStore.getState();
  const emailId = state.selectedEmailId;
  const draft = emailId
    ? state.drafts.find((d) => d.inReplyToEmailId === emailId && d.status !== 'discarded')
    : undefined;

  // ── send ──
  if (/^\s*(?:send|send (?:it|that|this|the (?:email|draft|reply)))[\s.!]*$/i.test(text)) {
    if (!emailId) return "Open an email first, then tell me to send.";
    if (!draft) return "There's no draft to send yet. Tap 'Generate AI reply draft' first.";
    if (draft.status === 'pending') return "The draft still needs a project link — handle that prompt first.";
    if (draft.status === 'sent') return "That draft has already been sent.";
    const sent = draftsService.send(draft.id);
    return sent ? "Sent." : "Couldn't send the draft.";
  }

  // ── regenerate ──
  if (/^\s*(?:regenerate|redraft|rewrite|redo)\s*(?:the\s+(?:reply|draft|email))?[\s.!]*$/i.test(text)) {
    if (!emailId) return "Open an email first.";
    await regenerateDraft(emailId);
    return "Regenerated the draft.";
  }

  // ── discard ──
  if (/^\s*(?:discard|throw out|delete|trash)\s*(?:the\s+)?(?:reply|draft)?[\s.!]*$/i.test(text)) {
    if (!draft) return "No draft to discard.";
    draftsService.discard(draft.id);
    return "Discarded.";
  }

  // ── edit reply to say X ──
  // Captures everything after "say": rep is dictating the new reply body.
  const editMatch = text.match(/^(?:edit|change|rewrite|update)\s+(?:the\s+)?(?:reply|draft|email)\s+to\s+say\s+(.+)$/i);
  if (editMatch) {
    if (!draft) return "Generate a draft first, then tell me how to edit it.";
    const newBody = wrapAsReplyBody(editMatch[1].trim());
    draftsService.update(draft.id, { body: newBody, isEdited: true });
    return "Updated the draft body.";
  }

  // ── attach X spec sheet / brochure ──
  const attachMatch = text.match(/^(?:attach|add)\s+(?:the\s+)?(.+?)\s+(?:spec\s+sheet|brochure|literature|catalog|brochures)\s*$/i);
  if (attachMatch) {
    if (!draft) return "Generate a draft first, then I can attach brochures.";
    const query = attachMatch[1].trim().toLowerCase();
    const brochure = state.brochures.find((b) =>
      b.name.toLowerCase().includes(query) ||
      b.brand.toLowerCase().includes(query) ||
      b.category.toLowerCase().includes(query) ||
      b.tags.some((t) => t.toLowerCase().includes(query)),
    );
    if (!brochure) return `Couldn't find a brochure matching "${query}".`;
    if (draft.attachedBrochureIds.includes(brochure.id)) return `${brochure.name} is already attached.`;
    draftsService.update(draft.id, {
      attachedBrochureIds: [...draft.attachedBrochureIds, brochure.id],
    });
    return `Attached ${brochure.name}.`;
  }

  // ── remove [X] attachment ──
  const removeMatch = text.match(/^(?:remove|drop)\s+(?:the\s+)?(.+?)\s+(?:attachment|brochure|spec\s+sheet)\s*$/i);
  if (removeMatch) {
    if (!draft || !draft.attachedBrochureIds.length) return "Nothing to remove.";
    const query = removeMatch[1].trim().toLowerCase();
    const bid = draft.attachedBrochureIds.find((id) => {
      const b = state.brochures.find((br) => br.id === id);
      return b && (b.name.toLowerCase().includes(query) || b.brand.toLowerCase().includes(query));
    });
    if (!bid) return `No attachment matches "${query}".`;
    const removed = state.brochures.find((b) => b.id === bid)?.name ?? 'attachment';
    draftsService.update(draft.id, {
      attachedBrochureIds: draft.attachedBrochureIds.filter((id) => id !== bid),
    });
    return `Removed ${removed}.`;
  }

  // ── read me this email / read the email ──
  if (/^\s*(?:read|read me|read out)\s+(?:this\s+|the\s+)?(?:email|message)[\s.!]*$/i.test(text)) {
    if (!emailId) return "Open an email first.";
    const email = state.emails.find((e) => e.id === emailId);
    if (!email) return "Couldn't find the email.";
    return `From ${email.fromName}. Subject: ${email.subject}. ${email.body}`;
  }

  return null;
}

// Wraps a dictated body fragment with a sensible greeting + sign-off so the
// voice-dictated reply still reads like a real email. The rep can tap Edit
// for finer control.
function wrapAsReplyBody(fragment: string): string {
  const state = useAppStore.getState();
  const emailId = state.selectedEmailId;
  const email = emailId ? state.emails.find((e) => e.id === emailId) : undefined;
  const rep = state.reps.find((r) => r.id === state.currentRepId) ?? state.reps[0];
  const senderFirst = email?.fromName.split(/\s+/)[0] || 'there';
  const repFirst = rep?.name.split(/\s+/)[0] ?? 'Colton';
  return `Hi ${senderFirst},\n\n${fragment}\n\nThanks,\n${repFirst}`;
}
