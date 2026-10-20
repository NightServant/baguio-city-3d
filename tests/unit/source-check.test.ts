import { describe, expect, it } from "vitest";
import { fetchSourceText, isPublicAddress, quoteFound } from "@/lib/corrections/source-check";

describe("isPublicAddress", () => {
  it("refuses private, loopback, link-local and metadata addresses", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.3.140", "100.64.0.1", "0.0.0.0", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])
      expect(isPublicAddress(ip), ip).toBe(false);
  });
  it("allows public addresses", () => {
    expect(isPublicAddress("93.184.216.34")).toBe(true);
    expect(isPublicAddress("2606:4700::1111")).toBe(true);
  });
});

describe("fetchSourceText refuses before any request", () => {
  it("http, private literals and names that resolve privately", async () => {
    expect(await fetchSourceText("http://example.com/")).toBeNull();
    expect(await fetchSourceText("https://127.0.0.1/")).toBeNull();
    expect(await fetchSourceText("https://[::1]/")).toBeNull();
    expect(await fetchSourceText("https://localhost/")).toBeNull();
    expect(await fetchSourceText("not a url")).toBeNull();
  });
});

describe("quoteFound", () => {
  it("finds the quote whatever the spacing and case", () => {
    expect(quoteFound("Hours:  We are OPEN daily\nfrom 8:00 am to 9:00 pm.", "we are open daily from 8:00 am to 9:00 pm")).toBe(true);
  });
  it("needs at least 20 characters and the words in order", () => {
    expect(quoteFound("open daily", "open daily")).toBe(false);
    expect(quoteFound("closed on Mondays and open daily from 8", "open daily from 8 and closed on Mondays")).toBe(false);
  });
});
