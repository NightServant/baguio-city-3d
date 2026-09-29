import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Baguio 3D collects, which map services see your IP address, and your rights under the Philippine Data Privacy Act.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "25 September 2026";
const HOST = "Vercel"; // Phase 0, D7
const analytics = Boolean(process.env.NEXT_PUBLIC_GA_ID);

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
          If you switch between light and dark, that choice is saved in your browser&apos;s local storage so
          the site remembers it. It stays on your device.
        </p>

        <h2>Services that see your IP address</h2>
        <p>
          Map tiles load straight from your browser to the companies that serve them, so each one receives
          your IP address and the part of the map you&apos;re looking at:
        </p>
        <ul>
          <li>OpenFreeMap, for the street map and labels (<code>tiles.openfreemap.org</code>)</li>
          <li>Amazon Web Services, for terrain heights (<code>s3.amazonaws.com</code>)</li>
          <li>
            Esri, only when you switch to satellite imagery or open a link that starts on it (
            <code>server.arcgisonline.com</code>)
          </li>
        </ul>
        <p>{HOST} hosts this site and keeps standard request logs.</p>
        <p>Fonts are served from this site, so your browser doesn&apos;t contact Google Fonts.</p>

        <h2 id="analytics">Analytics</h2>
        {analytics ? (
          <>
            <p>
              Analytics is off until you turn it on. Only if you choose &ldquo;Allow analytics&rdquo; does
              this site load Google Analytics 4, which sets cookies and records the pages you view, how you
              arrived, your device and browser, and your approximate location from your IP address. That
              data goes to Google.
            </p>
            <p>
              If you choose &ldquo;No thanks&rdquo;, or don’t choose, the analytics code never loads. Your
              choice is saved in your browser’s local storage. To withdraw, use &ldquo;Cookie
              settings&rdquo; at the bottom of every page: it clears the analytics cookies and reloads the
              page without the analytics code.
            </p>
          </>
        ) : (
          <p>This site doesn&apos;t use analytics or advertising cookies.</p>
        )}

        <h2>Correction reports</h2>
        <p>
          If you send a correction, we store what you wrote and the page it&apos;s about, plus your email
          only if you give one. We use the email only to reply about that report; it&apos;s cleared by a
          daily job once the report is resolved, or once it&apos;s 90 days old. The report stays without the
          email, as a record of what changed. We don&apos;t store your IP address with it. Reports are
          stored in a database hosted by Supabase.
        </p>

        <h2>AI</h2>
        <p>The site doesn&apos;t use AI to process anything you send or do.</p>
        {/* Phase 0, D6: if the owner confirms, add: "Some place descriptions were drafted with AI assistance and edited by hand." */}

        <h2>Your rights</h2>
        <p>
          Under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173) you can ask what we hold about
          you, ask us to correct or delete it, and object to its use.
          {CONTACT_EMAIL ? (
            <> Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</>
          ) : (
            <> Use the <a href="/corrections">correction form</a> and leave an email so we can reply.</>
          )}{" "}
          If you&apos;re not satisfied with our answer, you can complain to the{" "}
          <a href="https://privacy.gov.ph">National Privacy Commission</a>.
        </p>

        <h2>Children</h2>
        <p>The site isn&apos;t aimed at children and we don&apos;t knowingly collect their information.</p>

        <h2>Changes</h2>
        <p>When this policy changes, the date at the top changes with it.</p>
      </article>
    </>
  );
}
