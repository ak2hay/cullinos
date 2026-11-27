import { describe, expect, it } from "vitest";
import { resolveItemTap, type ChoiceItem } from "./itemChoices";

const plain: ChoiceItem = { id: "chai", name: "Chai", price: 4000 };

const sized: ChoiceItem = {
  id: "pizza",
  name: "Pizza",
  price: 29900,
  variants: [
    { id: "reg", name: "Regular", price: 29900, isDefault: true },
    { id: "lrg", name: "Large", price: 49900 },
  ],
};

const requiredSpice: ChoiceItem = {
  id: "wings",
  name: "Wings",
  price: 29900,
  modifierGroups: [
    {
      id: "spice",
      name: "Spice",
      minSelect: 1,
      maxSelect: 1,
      modifiers: [
        { id: "mild", name: "Mild", price: 0 },
        { id: "hot", name: "Hot", price: 0 },
      ],
    },
  ],
};

describe("resolveItemTap", () => {
  it("adds a plain item in one tap", () => {
    const tap = resolveItemTap(plain);
    expect(tap.needsModal).toBe(false);
    if (tap.needsModal) return;
    expect(tap.selection.unitPrice).toBe(4000);
    expect(tap.selection.variantId).toBeUndefined();
  });

  it("uses the default size without a dialog, then the last size", () => {
    const first = resolveItemTap(sized);
    expect(first.needsModal).toBe(false);
    if (first.needsModal) return;
    expect(first.selection.variantId).toBe("reg");

    const again = resolveItemTap(sized, { variantId: "lrg", modifierIds: [] });
    expect(again.needsModal).toBe(false);
    if (again.needsModal) return;
    expect(again.selection.variantId).toBe("lrg");
    expect(again.selection.unitPrice).toBe(49900);
  });

  it("asks only when a required choice has no default or memory", () => {
    const noDefault: ChoiceItem = {
      ...sized,
      variants: sized.variants?.map((variant) => ({ ...variant, isDefault: false })),
    };
    expect(resolveItemTap(noDefault).needsModal).toBe(true);
    expect(resolveItemTap(requiredSpice).needsModal).toBe(true);
    const remembered = resolveItemTap(requiredSpice, { modifierIds: ["hot"] });
    expect(remembered.needsModal).toBe(false);
    if (remembered.needsModal) return;
    expect(remembered.selection.name).toContain("Hot");
  });

  it("does not open a dialog for optional modifiers", () => {
    const optional: ChoiceItem = {
      ...requiredSpice,
      modifierGroups: requiredSpice.modifierGroups?.map((group) => ({
        ...group,
        minSelect: 0,
        isRequired: false,
      })),
    };
    expect(resolveItemTap(optional).needsModal).toBe(false);
  });
});
