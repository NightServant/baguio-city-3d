"use client";

import { useActionState } from "react";
import Button from "@mui/material/Button";
import { initialCorrectionState } from "@/lib/corrections";
import { submitCorrection } from "./actions";

const input =
  "mt-2 block w-full border border-border bg-card px-3 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-primary";

export function CorrectionForm({ page, startedAt, responseDays }: { page: string; startedAt: number; responseDays: number }) {
  const [state, action, pending] = useActionState(submitCorrection, initialCorrectionState);
  const e = state.errors ?? {};
  // Returned fields become the defaults, so React's post-action form reset
  // puts the visitor's text back instead of wiping it.
  const f = state.fields;

  return (
    <form action={action} noValidate className="mt-10 max-w-2xl space-y-7">
      {state.formError ? (
        <p role="alert" className="border-l-2 border-primary bg-card px-4 py-3 text-sm">{state.formError}</p>
      ) : null}
      {Object.keys(e).length > 0 ? (
        <p role="alert" className="border-l-2 border-primary bg-card px-4 py-3 text-sm">
          Check the highlighted field{Object.keys(e).length > 1 ? "s" : ""} below.
        </p>
      ) : null}

      <input type="hidden" name="startedAt" value={startedAt} />
      {/* Honeypot: hidden from people and assistive tech; bots fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <label htmlFor="page" className="font-medium">Which page?</label>
        <input id="page" name="page" defaultValue={f?.page ?? page} placeholder="/destinations/burnham-park" aria-invalid={!!e.page} aria-describedby={e.page ? "page-error" : "page-hint"} className={input} />
        <p id="page-hint" className="mt-1.5 text-sm text-muted-foreground">Leave it blank if it&apos;s about the whole site.</p>
        {e.page ? <p id="page-error" className="mt-1.5 text-sm text-primary">{e.page}</p> : null}
      </div>

      <div>
        <label htmlFor="message" className="font-medium">What&apos;s wrong?</label>
        <textarea id="message" name="message" rows={6} defaultValue={f?.message} required aria-invalid={!!e.message} aria-describedby={e.message ? "message-error" : "message-hint"} className={input} />
        <p id="message-hint" className="mt-1.5 text-sm text-muted-foreground">A closed shop, new hours, a fare that changed, a pin in the wrong place.</p>
        {e.message ? <p id="message-error" className="mt-1.5 text-sm text-primary">{e.message}</p> : null}
      </div>

      <div>
        <label htmlFor="email" className="font-medium">Email <span className="font-normal text-muted-foreground">(optional)</span></label>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={f?.email} aria-invalid={!!e.email} aria-describedby={e.email ? "email-error" : "email-hint"} className={input} />
        <p id="email-hint" className="mt-1.5 text-sm text-muted-foreground">Only if you want to hear back. We use it only for this report, and delete it once the report is resolved or after 90 days.</p>
        {e.email ? <p id="email-error" className="mt-1.5 text-sm text-primary">{e.email}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button type="submit" size="large" disabled={pending}>
          {pending ? "Sending report…" : "Send report"}
        </Button>
        <p className="text-sm text-muted-foreground">We read every report within {responseDays} days.</p>
      </div>
    </form>
  );
}
