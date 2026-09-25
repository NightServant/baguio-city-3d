import { expect, it, vi } from "vitest";

const { setexSpy } = vi.hoisted(() => ({ setexSpy: vi.fn() }));
vi.mock("ioredis", () => ({
  default: class {
    get = async () => null;
    setex = setexSpy;
    on() {
      return this;
    }
  },
}));

import { cacheAside } from "@/lib/redis";

it("does not cache a miss", async () => {
  await cacheAside("miss", 60, async () => null);
  expect(setexSpy).not.toHaveBeenCalled();
});

it("caches a hit", async () => {
  await cacheAside("hit", 60, async () => ({ ok: true }));
  expect(setexSpy).toHaveBeenCalledWith("hit", 60, '{"ok":true}');
});
