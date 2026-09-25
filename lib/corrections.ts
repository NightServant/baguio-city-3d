// Pure parsing and validation for the corrections form. No I/O, so it's
// tested directly; the server action only adds storage.

export interface CorrectionFields {
  page: string;
  message: string;
  email: string;
}
export type FieldErrors = Partial<Record<keyof CorrectionFields, string>>;
export interface CorrectionState {
  status: "idle" | "error";
  formError?: string;
  errors?: FieldErrors;
  fields?: CorrectionFields;
}
export const initialCorrectionState: CorrectionState = { status: "idle" };

/** A person takes longer than this to read the page and type a report. */
export const MIN_FILL_MS = 3000;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ParseResult =
  | { kind: "valid"; data: { page: string; message: string; email: string | null } }
  | { kind: "invalid"; state: CorrectionState }
  | { kind: "spam" };

export function parseCorrection(form: FormData, now: number): ParseResult {
  const str = (key: string) => String(form.get(key) ?? "").trim();

  if (str("website") !== "") return { kind: "spam" };
  const started = Number(str("startedAt"));
  if (!Number.isFinite(started) || now - started < MIN_FILL_MS) return { kind: "spam" };

  const fields: CorrectionFields = { page: str("page") || "/", message: str("message"), email: str("email") };
  const errors: FieldErrors = {};
  if (!fields.page.startsWith("/") || fields.page.length > 200) {
    errors.page = "Use an address from this site, starting with /.";
  }
  if (fields.message.length < 10) errors.message = "Tell us what's wrong in at least 10 characters.";
  else if (fields.message.length > 2000) errors.message = "Keep it under 2,000 characters.";
  if (fields.email && (fields.email.length > 254 || !EMAIL.test(fields.email))) {
    errors.email = "That email address looks incomplete.";
  }

  if (Object.keys(errors).length > 0) return { kind: "invalid", state: { status: "error", errors, fields } };
  return { kind: "valid", data: { page: fields.page, message: fields.message, email: fields.email || null } };
}
