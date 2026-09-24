import { expect, it } from "vitest";
import { FARE_SOURCE } from "@/lib/geo/fare";

it("fare figures carry a check date and an official source", () => {
  expect(FARE_SOURCE.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(FARE_SOURCE.jeepney.url).toMatch(/^https:\/\/([a-z0-9-]+\.)*ltfrb\.gov\.ph\//);
});
