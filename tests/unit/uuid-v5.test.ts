import { describe, expect, it } from "vitest";
import { uuidV5 } from "../../scripts/uuid-v5.mjs";

// RFC 4122 §4.3 DNS namespace, cross-checked against Python's uuid.uuid5:
// python3 -c "import uuid; print(uuid.uuid5(uuid.NAMESPACE_DNS, 'www.example.com'))"
// -> 2ed6657d-e927-568b-95e1-2665a8aea6a2
const NAMESPACE_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

describe("uuidV5", () => {
  it("matches the RFC-standard test vector", () => {
    expect(uuidV5("www.example.com", NAMESPACE_DNS)).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
  });

  it("is stable: the same input gives the same id twice", () => {
    expect(uuidV5("destinations:burnham-park", NAMESPACE_DNS)).toBe(
      uuidV5("destinations:burnham-park", NAMESPACE_DNS),
    );
  });

  it("gives different ids for different inputs", () => {
    expect(uuidV5("destinations:burnham-park", NAMESPACE_DNS)).not.toBe(
      uuidV5("destinations:session-road", NAMESPACE_DNS),
    );
  });
});
