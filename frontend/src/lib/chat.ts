import type { NdaForm, PartyInfo } from "@/lib/nda";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type PartyUpdate = { [K in keyof PartyInfo]?: string | null };
export type FieldsUpdate = {
  [K in keyof NdaForm]?: (NdaForm[K] extends PartyInfo ? PartyUpdate : NdaForm[K]) | null;
};

/** `fields` is an NdaForm-shaped update for the Mutual NDA and a term-to-value map otherwise. */
export interface ChatReply {
  reply: string;
  documentType: string | null;
  fields: FieldsUpdate | Record<string, string | null>;
}

/** Sent as the hidden first user turn so the AI opens the conversation. */
export const OPENING_MESSAGE: ChatMessage = {
  role: "user",
  content: "Hello, I would like to draft a legal document.",
};

/** Drops null, undefined and blank-string entries so an unsure model cannot wipe filled fields. */
function provided<T extends object>(update?: T | null): { [K in keyof T]?: NonNullable<T[K]> } {
  return Object.fromEntries(
    Object.entries(update ?? {}).filter(([, v]) => v != null && !(typeof v === "string" && !v.trim())),
  ) as { [K in keyof T]?: NonNullable<T[K]> };
}

/** Apply the values the AI extracted this turn; the backend schema already bounds years and date format. */
export function mergeFields(form: NdaForm, update: FieldsUpdate): NdaForm {
  const { party1, party2, ...rest } = update;
  return {
    ...form,
    ...(provided(rest) as Partial<NdaForm>),
    party1: { ...form.party1, ...provided(party1) },
    party2: { ...form.party2, ...provided(party2) },
  };
}

/** Apply the values the AI extracted this turn to a generic document's term-to-value map. */
export function mergeValues(values: Record<string, string>, update: Record<string, string | null>) {
  return { ...values, ...(provided(update) as Record<string, string>) };
}

export async function sendChat(
  messages: ChatMessage[],
  documentType: string | null,
  fields: object,
): Promise<ChatReply> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, documentType, fields }),
  });
  if (!response.ok) throw new Error(`Chat request failed (${response.status})`);
  return response.json();
}
