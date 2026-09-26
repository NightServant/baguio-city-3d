import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { fareAccuracyNote } from "@/lib/geo/fare";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms for using Baguio 3D: estimates you should confirm, the map data licenses we rely on, and how correction reports are used.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <>
      <Breadcrumbs trail={[{ name: "Terms of use", path: "/terms" }]} />
      <article className="legal-prose">
        <h1 className="mt-8 font-display text-4xl leading-[1.02] sm:text-5xl">Terms of use</h1>
        <p>Last updated 25 September 2026. By using Baguio 3D you agree to these terms.</p>

        <h2>What the site is</h2>
        <p>A free map and field guide to Baguio City for personal, non-commercial use.</p>

        <h2>Check before you travel</h2>
        <p>
          {fareAccuracyNote()} Opening hours can go out of date. Heights come from a terrain
          model, and both heights and map positions can be off. Confirm fares with the driver and
          hours with the place before you rely on them. We aren’t responsible for decisions
          made on this information.
        </p>

        <h2>Map data and credits</h2>
        <ul>
          <li>Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, available under the Open Database License.</li>
          <li>Map tiles and style by <a href="https://openfreemap.org">OpenFreeMap</a>.</li>
          <li>Terrain by Mapzen and Tilezen, through AWS Open Data.</li>
          <li>Satellite imagery © Esri, Maxar, Earthstar Geographics.</li>
        </ul>
        <p>Their own terms apply to their data.</p>

        <h2>Correction reports</h2>
        <p>
          Don&apos;t include other people&apos;s personal information in a report. By sending one, you let us
          use it to update the guide. We may edit or decline any report.
        </p>

        <h2>No warranty</h2>
        <p>
          The site is provided as it is, without warranties of any kind, to the extent Philippine law allows.
        </p>

        <h2>Governing law</h2>
        <p>These terms are governed by the laws of the Republic of the Philippines.</p>

        <h2>Contact</h2>
        <p>
          {CONTACT_EMAIL ? <>Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, or use the </> : <>Use the </>}
          <Link href="/corrections">correction form</Link>.
        </p>
      </article>
    </>
  );
}
