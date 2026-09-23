import { describe, expect, it } from "vitest";
import { encryptDocumentNumber } from "./privacy.crypto";

describe("encryptDocumentNumber production fail-closed", () => {
  it("throws in production when ENCRYPTION_KEY is missing", () => {
    const prevNode = process.env.NODE_ENV;
    const prevKey = process.env.ENCRYPTION_KEY;
    process.env.NODE_ENV = "production";
    delete process.env.ENCRYPTION_KEY;

    expect(() => encryptDocumentNumber("AB1234567")).toThrow(/ENCRYPTION_KEY/);

    process.env.NODE_ENV = prevNode;
    if (prevKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = prevKey;
  });
});
