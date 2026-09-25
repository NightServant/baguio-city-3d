import { expect, it } from "vitest";
import { FARE_SOURCE } from "@/lib/geo/fare";

it("fare figures carry a check date and an official source", () => {
  expect(FARE_SOURCE.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(FARE_SOURCE.traditional.url).toMatch(/^https:\/\/([a-z0-9-]+\.)*ltfrb\.gov\.ph\//);
});

it("the modern fare is verified against the LTFRB guide the owner supplied", () => {
  expect(FARE_SOURCE.modern.verified).toBe(true);
  expect(FARE_SOURCE.modern.effective).toBe("2026-03-19");
  expect(FARE_SOURCE.modern.validUntil).toBe("2026-06-30");
  expect(FARE_SOURCE.modern.label).toMatch(/Fare Guide/);
  // No URL: the guessed ltfrb.gov.ph link 403'd and isn't the real source —
  // the owner-supplied PDF is, recorded in `source` instead.
  expect(FARE_SOURCE.modern).not.toHaveProperty("url");
  expect(FARE_SOURCE.modern.source).toMatch(/owner/i);
});

it("the traditional fare is still unverified", () => {
  expect(FARE_SOURCE.traditional.verified).toBe(false);
});
