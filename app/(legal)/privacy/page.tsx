import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Baguio 3D collects, which map services see your IP address, and your rights under the Philippine Data Privacy Act.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "20 October 2026";
const HOST = "Vercel"; // Phase 0, D7

export default function PrivacyPage() {
  return (
    <>
      <Breadcrumbs trail={[{ name: "Privacy policy", path: "/privacy" }]} />
      <article className="legal-prose">
        <h1 className="mt-8 font-display text-4xl leading-[1.02] sm:text-5xl">Privacy policy</h1>
        <p>Last updated {UPDATED}.</p>
        <p>
          Baguio 3D is a free map and field guide. You can use all of it without an account. This page lists
          everything that happens to information about you when you do.
        </p>

        <h2>Using the map</h2>
        <p>
          There are no accounts, no sign-in, no payments and no uploads, and the site never asks for your
          location.
        </p>
        <p>
          If you switch between light and dark, that choice is saved in your browser’s local storage so
          the site remembers it. It stays on your device.
        </p>

        <h2>Services that see your IP address</h2>
        <p>
          Map tiles load straight from your browser to the companies that serve them, so each one receives
          your IP address and the part of the map you’re looking at:
        </p>
        <ul>
          <li>OpenFreeMap, for the street map and labels (<code>tiles.openfreemap.org</code>)</li>
          <li>Amazon Web Services, for terrain heights (<code>s3.amazonaws.com</code>)</li>
          <li>
            Esri, for the satellite imagery the 3D city stands on (<code>server.arcgisonline.com</code>)
          </li>
        </ul>
        <p>{HOST} hosts this site and keeps standard request logs.</p>
        <p>Fonts are served from this site, so your browser doesn’t contact Google Fonts.</p>

        <h2 id="analytics">Analytics</h2>
        <p>
          This site counts visits with Vercel Web Analytics, run by {HOST}, which hosts it. It sets no cookies and
          stores nothing in your browser. For each page view it records the page, the site you came from, your
          approximate location (country, region and city), and your device type, operating system and browser. It tells visits apart by a hash
          of the request, which it discards after 24 hours, and it doesn’t keep your IP address. We see only
          totals.
        </p>
        <p>This site uses no advertising and no advertising cookies.</p>

        <h2>Correction reports</h2>
        <p>
          If you send a correction, we store what you wrote, the page it’s about and your email, plus your name
          only if you give one, so the person who reads the report knows who sent it. We use the email only to
          tell you what happened to your report, in one email sent through Google’s Gmail. Only the people who run the site see the email and the name; a
          daily job clears both once the report is resolved and answered, or once it’s 90 days old. We delete what you wrote 12 months
          after you send it; the record of any change it made stays. We don’t store your IP address with it. Reports are stored in
          a database hosted by Supabase.
        </p>
        <p>
          To check a report automatically, we send its text and the page it’s about, never your email or name, through
          {" "}{HOST}’s AI Gateway to an AI model, Anthropic’s Claude Haiku 5.5, which may search the web for a public
          source with Perplexity search, run by the gateway. Anthropic doesn’t train its models on what we send.
          A change goes into the guide only if a public page states it word for word. No decision about you is made
          automatically: the check decides only whether the guide changes.
        </p>
        <p>
          After you send a report you get a private status page. Anyone with its address can see whether the report
          was checked, but not what you wrote.
        </p>

        <h2>Why we may use it, and where it goes</h2>
        <p>
          We store and check a report, and email you its result, because you send it to us to fix the guide, and we count visits because we
          have a legitimate interest in knowing how the site is used (Data Privacy Act, Section 12). The services
          named on this page run outside the Philippines: the database in Singapore, and the host, the AI model,
          the search and Gmail mostly in the United States. We stay responsible for your information wherever they hold
          it.
        </p>

        <h2>AI</h2>
        <p>
          A correction you send is checked by an AI model, as described above; it can change only opening hours
          and price ranges, and only when a public page states the change. Nothing else you send or do is
          processed by AI. Some place descriptions were drafted with AI assistance and edited by hand.
        </p>

        <h2>Your rights</h2>
        <p>
          Under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173) you have the right to be informed,
          to see what we hold about you, to have it corrected, deleted or blocked, to object to its use, to get a
          copy you can take elsewhere, and to be compensated for damage from its misuse.
          {CONTACT_EMAIL ? (
            <> Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</>
          ) : (
            <> Use the <a href="/corrections">correction form</a>; until a contact address is listed here, we can’t write back to you.</>
          )}{" "}
          If you’re not satisfied with our answer, you can complain to the{" "}
          <a href="https://privacy.gov.ph">National Privacy Commission</a>.
        </p>

        <h2>Children</h2>
        <p>The site isn’t aimed at children and we don’t knowingly collect their information.</p>

        <h2>Changes</h2>
        <p>When this policy changes, the date at the top changes with it.</p>
      </article>
    </>
  );
}
