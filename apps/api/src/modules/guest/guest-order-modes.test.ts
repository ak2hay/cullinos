import { describe, expect, it } from "vitest";
import { guestOrderModes } from "./marketplace.service";

describe("guestOrderModes", () => {
  const qrOnly = { enabledOrderTypes: ["qr"] };

  it("serves QR orders at the table when the outlet uses tables", () => {
    const modes = guestOrderModes("cafe", qrOnly, {});
    expect(modes.dineIn).toBe(true);
    expect(modes.takeaway).toBe(false);
  });

  it("turns QR into a counter token order when the outlet turned tables off", () => {
    const modes = guestOrderModes("cafe", qrOnly, { tablesEnabled: false });
    expect(modes.dineIn).toBe(false);
    expect(modes.takeaway).toBe(true);
  });

  it("keeps counter eat-in when dine-in is enabled and tables are off", () => {
    const modes = guestOrderModes(
      "cafe",
      { enabledOrderTypes: ["dine_in", "takeaway", "qr"] },
      { tablesEnabled: false },
    );
    expect(modes.dineIn).toBe(true);
    expect(modes.takeaway).toBe(true);
  });

  it("lets a QSR outlet that turned tables on seat QR guests", () => {
    const modes = guestOrderModes("qsr", qrOnly, { tablesEnabled: true });
    expect(modes.dineIn).toBe(true);
  });
});
