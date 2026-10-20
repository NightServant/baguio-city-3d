# Privacy self-review, 20 October 2026

**What this is.** The owner skipped the lawyer review (finishes plan Task 11) to launch sooner. This is a self-review by
the developer, not legal advice. It checks `/privacy` and `/terms` against the Data Privacy Act of 2012 (RA 10173) and
its Implementing Rules (IRR), as the site stands on commit `4d82ff4`. Hand it to a lawyer when there is time.

## What the site collects

| Data | From whom | Where it goes | Kept |
|---|---|---|---|
| Report text and page | Anyone who sends a correction | Supabase (Singapore); text and page sent to Vercel AI Gateway, Anthropic (Claude Haiku 5.5) and Perplexity search for the automatic check | Text deleted 12 months after sending (daily job, finding 4) |
| Name (optional) | Reporters who give one | Supabase only; never sent to the model | Until the report is resolved, at most 90 days (daily job) |
| Visit counts | Every visitor | Vercel Web Analytics: page, referrer, approximate location, device, OS, browser; no cookies; request hash discarded after 24 hours | Vercel's retention |
| IP address and the map area viewed | Every visitor of the map | OpenFreeMap, AWS, Esri (tile requests); Vercel request logs | Their retention |
| Theme choice | Visitors who switch it | The visitor's own browser (local storage) | Until cleared |

No accounts, payments, uploads, location requests, advertising, cookies or email addresses.

## Privacy notice contents (IRR Section 34(a)(2))

| Item | Status |
|---|---|
| (a) Description of the personal data | Covered |
| (b) Purposes | Covered; the name's purpose added on 20 Oct |
| (c) Basis of processing | Added on 20 Oct: the reporter's own request (consent); legitimate interest for visit counts (Section 12) |
| (d) Scope and method | Covered |
| (e) Recipients | Covered; transfers outside the Philippines added on 20 Oct (Section 21 accountability) |
| (f) Automated processing | Covered: the AI check, its limits, and that no decision is made about the person |
| (g) Identity and contact details of the controller | Contact set (baguioadmin@gmail.com, 20 Oct); **the controller's name is still missing** (finding 1) |
| (h) Retention period | Covered: names (resolved or 90 days), report text (12 months), analytics (Vercel) |
| (i) Rights, including a complaint to the NPC | Covered; the full list added on 20 Oct |

## Findings

1. **Say who runs the site.** The contact is set: `NEXT_PUBLIC_CONTACT_EMAIL` = baguioadmin@gmail.com in Vercel
   (production, 20 Oct), shown in the footer and in the privacy and terms pages. The page still names no controller.
   *Owner:* choose the name to publish (yourself or an organisation); it is one sentence.
2. **Ask the NPC whether registration applies.** NPC Circular 2022-04 requires registration from controllers with 250 or
   more employees or processing sensitive personal information of 1,000 or more people, which this site isn't. It also
   names processing that is "likely to pose a risk" or "not occasional", and secondary sources disagree on whether
   those below the thresholds must file a sworn declaration of exemption. *Owner:* ask the NPC through privacy.gov.ph.
   If registration applies, a Data Protection Officer must be named (the owner can be one).
3. **Esri imagery terms.** The satellite ground is loaded straight from `server.arcgisonline.com` without an ArcGIS
   account or key. Attribution is shown, but Esri's terms for its basemap services should be read for public,
   non-ArcGIS use. Not a privacy item; a licensing one.
4. **Report text kept forever. Fixed 20 Oct** (owner's go): a daily job (`expire-correction-text`, migration
   `20261020040426`) replaces the text 12 months after sending; the row keeps its page, status and dates, and the
   audit table keeps any change with its public source and quote. The privacy page says so.
5. **Reporters may type personal data into the message**, and the message goes to the AI model. The terms already ask
   people not to include others' personal information. Acceptable as is; worth a line on the form if it happens.
6. **Breaches.** If report data is ever exposed, NPC Circular 16-03 sets the notification duties (72 hours where it
   applies). Nothing to build; know where the rule is.

Fixed during this review: the email field (replaced by an optional name, its column dropped), the "AI" section that
still said reports weren't processed by AI, the missing basis, transfers and rights, and the thanks page's promise of
an emailed reply.

## Sources

- Data Privacy Act IRR, Section 34 (reproduced at pnl-law.com/blog/?p=6136; check the official text)
- NPC Circular 2022-04 (privacy.gov.ph; summaries by digitalpolicyalert.org, mondaq.com, globalcompliancenews.com)
- Vercel Web Analytics, Privacy and Compliance (vercel.com/docs/analytics/privacy-policy)
