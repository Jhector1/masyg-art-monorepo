// File: src/__tests__/pricing.spec.ts
import { Prisma } from "@prisma/client";

// ---- System under test: import everything we need ----
import {
  toJsonInput,
  toNullableJson,
  // parseWh is internal/private – covered via public funcs (areaInSqIn, cleanSizes, getSizeMultiplier)
  // clamp is internal – behavior covered via cleanSizes/getSizeMultiplier bounds
  roundTo,
  areaInSqIn,
  priceForSize,
  cleanSizes,
  getSizeMultiplier,
  toDate,
} from "../utils/helpers";

import {
  computeDigitalPrice,
  computePrintPrice,
} from "../utils/pricing";

import {
  getEffectiveSale,
  computeBaseUnit,
  roundMoney,
  applyBundleIfBoth,
} from "../lib/pricing";

// ---- Mock data tables pulled by computeBaseUnit ----
jest.mock("@/data/helpers", () => ({
  allLicenses: [
    { type: "personal", price: 0 },
    { type: "commercial", price: 20 },
    { type: "extended", price: 80 },
  ],
  allMaterials: [
    { label: "Paper", multiplier: 1 },
    { label: "Canvas", multiplier: 1.25 },
    { label: "Metal", multiplier: 1.5 },
  ],
  allFrames: [
    { label: "None", multiplier: 1 },
    { label: "Black Frame", multiplier: 1.3 },
    { label: "White Frame", multiplier: 1.3 },
  ],
}));

// Helper to freeze time in sale tests
const d = (s: string) => new Date(s);

describe("JSON helpers", () => {
  test("toJsonInput returns Prisma.JsonNull for null/undefined", () => {
    expect(toJsonInput(null)).toBe(Prisma.JsonNull);
    expect(toJsonInput(undefined)).toBe(Prisma.JsonNull);
  });

  test("toJsonInput passes through valid JsonValue", () => {
    const obj = { a: 1, b: ["x"] };
    const out = toJsonInput(obj);
    expect(out).toEqual(obj);
  });

  test("toNullableJson returns null for null/undefined", () => {
    expect(toNullableJson(null)).toBeNull();
    expect(toNullableJson(undefined)).toBeNull();
  });

  test("toNullableJson passes through valid JsonValue", () => {
    const arr = [1, 2, 3];
    expect(toNullableJson(arr)).toEqual(arr);
  });
});

describe("roundTo (step rounding)", () => {
  test.each`
    v        | step     | want
    ${1.01}  | ${0.05}  | ${1.0}
    ${1.02}  | ${0.05}  | ${1.0}
    ${1.03}  | ${0.05}  | ${1.05}
    ${1.07}  | ${0.05}  | ${1.05}
    ${1.08}  | ${0.05}  | ${1.1}
    ${2.49}  | ${0.1}   | ${2.5}
    ${2.44}  | ${0.1}   | ${2.4}
    ${0.333} | ${0.001} | ${0.333}
  `("roundTo($v, $step) = $want", ({ v, step, want }) => {
    expect(roundTo(v, step)).toBeCloseTo(want, 10);
  });

  test("handles non-integer step decimals correctly", () => {
    expect(roundTo(1.234, 0.025)).toBeCloseTo(1.225, 10);
  });
});

describe("size parsing + areaInSqIn", () => {
  test.each`
    size             | area
    ${"10x12"}       | ${120}
    ${"10 x 12"}     | ${120}
    ${'10" x 12"'}   | ${120}
    ${"10in×12in"}   | ${120}
    ${"10.5×12.25"}  | ${128.625}
    ${"  8 x 10  "}  | ${80}
  `("areaInSqIn('$size') -> $area", ({ size, area }) => {
    expect(areaInSqIn(size)).toBeCloseTo(area, 10);
  });

  test.each(["", "abc", "12", "x12", "12 x", '12" foo 9"'])(
    "areaInSqIn('%s') -> 0 for invalid",
    (size) => {
      expect(areaInSqIn(size)).toBe(0);
    }
  );
});

describe("priceForSize (linear area pricing)", () => {
  test("base + area*rate, rounded to cents", () => {
    // base=10, rate=0.15, size=10x12 → area=120 → 10 + 120*.15 = 28
    expect(priceForSize(10, 0.15, "10x12")).toBe(28);
  });

  test("another case with cents", () => {
    // base=25.99, rate=0.15, size=10x10 → area=100 → 25.99 + 100*.15 = 40.99
    expect(priceForSize(25.99, 0.15, "10x10")).toBe(40.99);
  });

  test("invalid size returns just base rounded", () => {
    expect(priceForSize(19.995, 5, "nope")).toBe(20.0);
  });
});

describe("cleanSizes (area-based multipliers with baseline rules)", () => {
  const sizes = ["8x10", '10" x 12"', "16×20", "24 x 36", "12 x 12"];

  test("baseline=min (default): smallest area is 8x10=80 → its multiplier=1", () => {
    const out = cleanSizes(sizes);
    const m8x10 = out.find((x) => x.label.toLowerCase() === "8x10")!;
    expect(m8x10.multiplier).toBe(1);
    const m16x20 = out.find(
      (x) =>
        x.label.toLowerCase().includes("16×20") ||
        x.label.toLowerCase().includes("16x20")
    )!;
    expect(m16x20.multiplier).toBeGreaterThan(1);
  });

  test("baseline=first: first is 8x10 → same as min here; stays 1", () => {
    const out = cleanSizes(sizes, { baseline: "first" });
    const m8x10 = out.find((x) => x.label.toLowerCase() === "8x10")!;
    expect(m8x10.multiplier).toBe(1);
  });

  test('baseline="12x12": base area 144 → 8x10 multiplier = 80/144 ≈ 0.56 (rounded to step)', () => {
    const out = cleanSizes(sizes, { baseline: "12x12", step: 0.01 });
    const m8x10 = out.find((x) => x.label.toLowerCase() === "8x10")!;
    expect(m8x10.multiplier).toBeCloseTo(80 / 144, 2);
  });

  test("applies minMult/maxMult clamps before rounding", () => {
    const out = cleanSizes(sizes, { minMult: 0.75, maxMult: 2.0, step: 0.01 });
    const small = out.find((x) => x.label.toLowerCase() === "8x10")!;
    const huge = out.find((x) => x.label.toLowerCase().includes("24"))!;
    expect(small.multiplier).toBeGreaterThanOrEqual(0.75);
    expect(huge.multiplier).toBeLessThanOrEqual(2.0);
  });

  test("invalid/zero sizes fall back safely to baseline area", () => {
    const out = cleanSizes(["8x10", "badsize", "  "], { step: 0.01 });
    expect(out).toHaveLength(3);
    const bad = out.find((x) => x.label === "badsize")!;
    expect(bad.multiplier).toBeCloseTo(1, 2);
  });

  test("empty or undefined input returns []", () => {
    // @ts-expect-error testing undefined pathway
    expect(cleanSizes(undefined)).toEqual([]);
    expect(cleanSizes([])).toEqual([]);
  });
});

describe("getSizeMultiplier", () => {
  const sizes = ["8x10", "10x12", "12x12", "16x20"];

  test("exact hit uses table (baseline=min default)", () => {
    const m = getSizeMultiplier("16x20", sizes, { step: 0.01 });
    expect(m).toBeCloseTo((16 * 20) / (8 * 10), 2); // 320/80=4.0
  });

  test('anchor baseline "12x12"', () => {
    const m = getSizeMultiplier("8x10", sizes, { baseline: "12x12", step: 0.01 });
    expect(m).toBeCloseTo(80 / 144, 2);
  });

  test("fallback compute when requested size not in list", () => {
    const m = getSizeMultiplier("24x36", sizes, { step: 0.01 });
    expect(m).toBeCloseTo(864 / 80, 2); // 10.8
  });

  test("respects minMult/maxMult bounds", () => {
    const m = getSizeMultiplier("1x1", sizes, { minMult: 0.5, maxMult: 2, step: 0.01 });
    expect(m).toBeGreaterThanOrEqual(0.5);
    expect(m).toBeLessThanOrEqual(2);
  });

  test("no size passed returns 1", () => {
    // @ts-expect-error testing nullable path
    expect(getSizeMultiplier(null, sizes)).toBe(1);
  });

  test("no list passed returns 1", () => {
    // @ts-expect-error testing missing list
    expect(getSizeMultiplier("8x10", undefined)).toBe(1);
  });
});

describe("date util: toDate", () => {
  test("passes through Date", () => {
    const now = new Date();
    expect(toDate(now)).toBe(now);
  });

  test("parses string to Date", () => {
    const dd = toDate("2025-01-02T03:04:05Z")!;
    expect(dd instanceof Date).toBe(true);
    expect(isNaN(dd.getTime())).toBe(false);
  });

  test("null/undefined returns null", () => {
    // @ts-expect-error test null path
    expect(toDate(null)).toBeNull();
    // @ts-expect-error test undefined path
    expect(toDate(undefined)).toBeNull();
  });
});

describe("purchase/pricing leaf functions", () => {
  test("computeDigitalPrice = base + license.price", () => {
    expect(computeDigitalPrice(10, { type: "commercial", price: 20 } as any)).toBe(30);
    expect(computeDigitalPrice(10, { type: "personal", price: 0 } as any)).toBe(10);
  });

  test("computePrintPrice uses (base + sizeAmount) × material × frame", () => {
    // We can't see RATE_PER_SQIN, but we can test proportionality.
    const base = 100;

    const pBare = computePrintPrice(
      base,
      { label: "8x10" } as any,
      { label: "Paper", multiplier: 1 } as any,
      null
    );

    const pMF = computePrintPrice(
      base,
      { label: "8x10" } as any,
      { label: "Canvas", multiplier: 1.25 } as any,
      { label: "Black Frame", multiplier: 1.3 } as any
    );

    // Material+frame should scale the whole thing multiplicatively:
    expect(pMF / pBare).toBeCloseTo(1.25 * 1.3, 6);

    // Adding a frame later should be equivalent to multiplying by frame factor
    const pM = computePrintPrice(
      base,
      { label: "8x10" } as any,
      { label: "Canvas", multiplier: 1.25 } as any,
      null
    );
    expect(pMF / pM).toBeCloseTo(1.3, 6);
  });

  test("computePrintPrice: base shift adds (Δbase × material × frame)", () => {
    const size = { label: "12x12" } as any;
    const material = { label: "Canvas", multiplier: 1.25 } as any;
    const frame = { label: "Black Frame", multiplier: 1.3 } as any;

    const p1 = computePrintPrice(100, size, material, frame);
    const p2 = computePrintPrice(110, size, material, frame);

    // Increase base by 10 → final increases by 10 * mm * fm
    expect(p2 - p1).toBeCloseTo(10 * 1.25 * 1.3, 6);
  });

  test("computePrintPrice: linear in area (size amount is additive)", () => {
    const base = 100;
    const material = { label: "Paper", multiplier: 1 } as any;
    const frame = null;

    const pSmall = computePrintPrice(base, { label: "8x10" } as any, material, frame);  // area 80
    const pMid   = computePrintPrice(base, { label: '12" x 12"' } as any, material, frame); // area 144
    const pLarge = computePrintPrice(base, { label: "16x20" } as any, material, frame); // area 320

    const d1 = pMid - pSmall;   // should be proportional to (144 - 80)
    const d2 = pLarge - pSmall; // proportional to (320 - 80)

    const a1 = 144 - 80;
    const a2 = 320 - 80;

    // The ratio of price increases should match the ratio of area increases.
    expect(d1 / a1).toBeCloseTo(d2 / a2, 6);
  });
});

describe("sale logic: getEffectiveSale", () => {
  const now = d("2025-01-01T12:00:00Z");

  test("inactive window → returns base price, no sale", () => {
    const r = getEffectiveSale(
      {
        price: 100,
        salePrice: 80,
        saleStartsAt: d("2025-02-01T00:00:00Z"),
        saleEndsAt: d("2025-03-01T00:00:00Z"),
      },
      now
    );
    expect(r).toEqual({ price: 100, compareAt: null, onSale: false, endsAt: null });
  });

  test("salePrice precedence when active", () => {
    const r = getEffectiveSale(
      {
        price: 100,
        salePrice: 70.123, // will be fixed to 2 decimals
        saleStartsAt: d("2024-12-01T00:00:00Z"),
        saleEndsAt: d("2025-02-01T00:00:00Z"),
      },
      now
    );
    expect(r.price).toBeCloseTo(70.12, 2);
    expect(r.compareAt).toBe(100);
    expect(r.onSale).toBe(true);
    expect(r.endsAt?.toISOString()).toBe("2025-02-01T00:00:00.000Z");
  });

  test("salePercent fallback when active", () => {
    const r = getEffectiveSale(
      {
        price: 200,
        salePercent: 25,
        saleStartsAt: d("2024-12-01T00:00:00Z"),
        saleEndsAt: d("2025-02-01T00:00:00Z"),
      },
      now
    );
    expect(r.price).toBe(150);
    expect(r.compareAt).toBe(200);
    expect(r.onSale).toBe(true);
  });

  test("no sale fields but active window concept → returns base", () => {
    const r = getEffectiveSale({ price: 99 }, now);
    expect(r).toEqual({ price: 99, compareAt: null, onSale: false, endsAt: null });
  });
});

describe("computeBaseUnit (digital + print)", () => {
  const sizeList = ["8x10", "12x12", "16x20", "24x36"] as const;

  test("digital only: base + license add", () => {
    const price = computeBaseUnit({
      productBase: 100,
      digital: true,
      license: "commercial",
      sizeList: [...sizeList],
    });
    expect(price).toBe(120); // 100 + 20
  });

  test("print only: material/frame multiply whole (base + sizeAmount)", () => {
    // We validate proportionality rather than exact constant.
    const argsBase = {
      productBase: 100,
      print: true as const,
      size: "16x20", // area 320
      sizeList: [...sizeList],
      material: "Paper",
      frame: "None",
    };

    const pBare = computeBaseUnit(argsBase);
    const pMF = computeBaseUnit({ ...argsBase, material: "Canvas", frame: "Black Frame" });

    expect(pMF / pBare).toBeCloseTo(1.25 * 1.3, 6);
  });

  test("digital + print sums to each component", () => {
    const base = 50;
    const digitalOnly = computeBaseUnit({
      productBase: base,
      digital: true,
      license: "extended", // +80
      sizeList: [...sizeList],
    }); // = 130

    const printOnly = computeBaseUnit({
      productBase: base,
      print: true,
      size: "12x12",
      material: "Metal", // 1.5
      frame: "None",
      sizeList: [...sizeList],
    });

    const both = computeBaseUnit({
      productBase: base,
      digital: true,
      license: "extended",
      print: true,
      size: "12x12",
      material: "Metal",
      frame: "None",
      sizeList: [...sizeList],
    });

    // additivity: both should equal digitalOnly + printOnly
    expect(both).toBeCloseTo(digitalOnly + printOnly, 6);
  });

  test("invalid size falls back safely (area=0 → behaves like baseline add 0)", () => {
    const price = computeBaseUnit({
      productBase: 100,
      print: true,
      size: "bad-size",
      material: "Paper",
      frame: "None",
      sizeList: [...sizeList],
    });
    // With area treated as 0 and multipliers = 1, price = base
    expect(price).toBe(100);
  });
});

describe("money helpers", () => {
  test("roundMoney uses toFixed(2) semantics", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.004)).toBe(2.0);
    expect(roundMoney(2.005)).toBe(2.01);
    expect(roundMoney(0)).toBe(0);
  });

  test("applyBundleIfBoth applies % off only when both are present", () => {
    expect(applyBundleIfBoth(100, true, true, 0.2)).toBe(80);
    expect(applyBundleIfBoth(100, {}, { x: 1 }, 0.2)).toBe(80);
    expect(applyBundleIfBoth(100, true, false, 0.2)).toBe(100);
    expect(applyBundleIfBoth(100, null, "y", 0.2)).toBe(100);
  });
});
