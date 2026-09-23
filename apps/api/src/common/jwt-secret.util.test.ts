import { describe, expect, it } from "vitest";
import { getJwtSecret } from "./jwt-secret.util";

describe("getJwtSecret", () => {
  it("returns JWT_SECRET when set", () => {
    expect(
      getJwtSecret({ JWT_SECRET: "my-secret-value", NODE_ENV: "development" } as NodeJS.ProcessEnv),
    ).toBe("my-secret-value");
  });

  it("falls back in non-production when unset", () => {
    expect(getJwtSecret({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe("dev-secret");
  });

  it("throws in production when unset", () => {
    expect(() => getJwtSecret({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(
      /JWT_SECRET/,
    );
  });
});
