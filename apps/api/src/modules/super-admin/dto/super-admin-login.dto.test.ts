import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { SuperAdminLoginDto } from "./super-admin.dto";

describe("SuperAdminLoginDto", () => {
  it("trims and lowercases the email so invites (stored lowercase) can sign in", async () => {
    const dto = plainToInstance(SuperAdminLoginDto, { email: "  Ops.Lead@Rkyves.com ", password: "Temp#Pass123!" });
    expect(dto.email).toBe("ops.lead@rkyves.com");
    expect(await validate(dto)).toHaveLength(0);
  });
});
