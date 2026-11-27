import { describe, expect, it } from "vitest";
import { syncWithRetry } from "./cashSync";

describe("syncWithRetry", () => {
  it("returns as soon as the call succeeds and does not wait first", async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const result = await syncWithRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("offline");
        return "placed";
      },
      { sleep: async (ms) => { sleeps.push(ms); } },
    );
    expect(result).toBe("placed");
    expect(calls).toBe(3);
    expect(sleeps).toEqual([400, 800]);
  });

  it("throws after the last attempt", async () => {
    await expect(
      syncWithRetry(async () => { throw new Error("down"); }, { attempts: 2, sleep: async () => undefined }),
    ).rejects.toThrow("down");
  });
});
