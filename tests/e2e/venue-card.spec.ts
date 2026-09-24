import { expect, test } from "@playwright/test";

test("clicking anywhere on a venue card opens it on the map", async ({ page }) => {
  await page.goto("/eat-stay");
  const card = page.locator("article").first();
  const description = card.locator("p").first(); // the description, not the name
  // The stretched link's ::after covers the card, so a plain click's
  // actionability check sees the <a> intercept the click on the <p> and
  // times out. force: true skips that "receives events" check and clicks
  // through to whatever is actually topmost at that point — the link —
  // which is exactly what "click anywhere on the card" is testing. force
  // also skips the auto-scroll Playwright normally does as part of
  // actionability, so scroll explicitly first or the immediate visibility
  // snapshot force takes can race the page settling right after
  // navigation.
  await description.scrollIntoViewIfNeeded();
  await description.click({ force: true });
  await expect(page).toHaveURL(/\/map\?venue=/);
});
