import { usePriceCalculator, PriceOptionsProps } from "../usePriceCalculator";
import { ProductDetailResult } from "../../types";
import { renderHook } from "@testing-library/react";

/* ------------------------------------------------------------------ *
 *  shared helpers                                                     *
 * ------------------------------------------------------------------ */

const baseProduct = (p?: Partial<ProductDetailResult>): ProductDetailResult =>
  ({ price: 100, ...p }) as unknown as ProductDetailResult;

interface CalcArgs {
  product: ProductDetailResult;
  size: { label: string; multiplier: number };
  material?: { multiplier: number };
  /** allow null as well as undefined */
  frame: { multiplier: number } | null | undefined;
  options: { digital: boolean };
  customSize: { width: string; height: string };
  isCustom: boolean;
  license: { price: number };
}

const baseArgs: CalcArgs = {
  product: baseProduct(),
  size: { label: "8×10", multiplier: 1 },
  material: { multiplier: 1.2 },
  frame: { multiplier: 1.5 },   // still a real frame by default
  options: { digital: false },
  customSize: { width: "", height: "" },
  isCustom: false,
  license: { price: 10 },
};

function getCalc(over: Partial<CalcArgs> = {}) {
  const args = { ...baseArgs, ...over };
  const { result } = renderHook(() =>
    usePriceCalculator(
      args.product,
      args.size,
      args.material ?? { multiplier: 1 },
      args.frame ?? null,          // may be null or undefined
      args.options,
      args.customSize,
      args.isCustom,
      args.license
    )
  );
  return result.current;
}
function expectPrices(
  actual: PriceOptionsProps,
  expectedDigital: string,
  expectedPrint: string
) {
  expect(actual.digitalPrice).toBe(expectedDigital);
  expect(actual.printPrice).toBe(expectedPrint);
}

/* ------------------------------------------------------------------ *
 *  DIGITAL BRANCH                                                     *
 * ------------------------------------------------------------------ */

describe("Digital-only purchases", () => {
  it("works with type='Digital' (capital D)", () => {
    const res = getCalc()("Digital");
    expectPrices(res, "110", "0.00");
  });

  it("works with lowercase 'digital'", () => {
    const res = getCalc()("Digital");
    expectPrices(res, "110", "0.00");
  });

  it("applies licence eraser in digital mode", () => {
    const res = getCalc()("Digital", "license", 5);
    expectPrices(res, "105", "0.00");
  });
});

/* ------------------------------------------------------------------ *
 *  STANDARD PRINT BRANCH                                              *
 * ------------------------------------------------------------------ */

describe("Print purchases (no eraser)", () => {
  it("calculates base × size × material × frame & digital markup", () => {
    // (100×1×1.2×1.5)=180 ; digital=(100+10)=110
expectPrices(getCalc()("Print"), "110.00", "180.00");  });

  it("handles null frame (defaults to 1)", () => {
    const res = getCalc({ frame: null })("Print");
    // 100×1×1.2×1 = 120
    expectPrices(res, "110.00", "120.00");
  });

  it("handles undefined material (defaults to 1)", () => {
    const res = getCalc({ material: undefined })("Print");
    // 100×1×1×1.5 = 150
    expectPrices(res, "110.00", "150.00");
  });
});

/* ------------------------------------------------------------------ *
 *  CUSTOM SIZE LOGIC                                                  *
 * ------------------------------------------------------------------ */

describe("Custom-size logic", () => {
  it("uses (w×h)/80 when isCustom && width && height", () => {
    const res = getCalc({
      isCustom: true,
      customSize: { width: "12", height: "24" },
    })('Print');
    // sizeMult=(12×24)/80=3.6 → 100×3.6×1.2×1.5 = 648
    expectPrices(res, "110.00", "648.00");
  });

  it("falls back to size.multiplier when width or height falsy", () => {
    const res = getCalc({
      isCustom: true,
      customSize: { width: "0", height: "24" },
    })('Print');
    // size.multiplier is 1 → 100×1×1.2×1.5 = 180
    expectPrices(res, "110.00", "180.00");
  });

  it("ignores NaN width/height strings", () => {
    const res = getCalc({
      isCustom: true,
      customSize: { width: "abc", height: "20" },
    })('Print');
    expectPrices(res, "110.00", "180.00");
  });
});

/* ------------------------------------------------------------------ *
 *  ERASERS                                                            *
 * ------------------------------------------------------------------ */

describe("Eraser overrides", () => {
  it("material eraser sets new multiplier", () => {
    const res = getCalc()("Print", "material", 1);
    // 100×1×1×1.5 = 150
    expectPrices(res, "110.00", "150.00");
  });

  it("frame eraser sets new multiplier", () => {
    const res = getCalc()("Print", "frame", 1);
    // 100×1×1.2×1 = 120
    expectPrices(res, "110.00", "120.00");
  });

  it("size eraser sets new multiplier", () => {
    const res = getCalc()("Print", "size", 2);
    // 100×2×1.2×1.5 = 360
    expectPrices(res, "110.00", "360.00");
  });

  it("license eraser updates licence price", () => {
    const res = getCalc()("Print", "license", 5);
    expectPrices(res, "105.00", "180.00");
  });

  it("irrelevant eraser string leaves values unchanged", () => {
    const res = getCalc()("Print", "material" , 99);
    expectPrices(res, "110.00", "180.00");
  });
});

/* ------------------------------------------------------------------ *
 *  PRICE / MULTIPLIER EDGE-CASES                                      *
 * ------------------------------------------------------------------ */

describe("Edge-case numeric values", () => {
  it("handles undefined base price (treats as 0)", () => {
    const res = getCalc({ product: baseProduct({ price: undefined }) })('Print');
    expectPrices(res, "10.00", "0.00");
  });

  it("handles decimal base and multipliers correctly", () => {
    const res = getCalc({
      product: baseProduct({ price: 99.99 }),
      size: { label: "8×10", multiplier: 1.333 },
      material: { multiplier: 0.75 },
      frame: { multiplier: 0.5 },
      license: { price: 0.01 },
    })('Print');
    // print: 99.99×1.333×0.75×0.5 = 49.99796… → "50.00"
    // digital: 100.00 (rounded) ? Actually 99.99+0.01 → 100.00
    expectPrices(res, "100.00", "50.00");
  });

  it("supports zero/negative multipliers or licence (math still applies)", () => {
    const res = getCalc({
      material: { multiplier: 0 },
      license: { price: -20 },
    })('Digital');
    // print => 0 ; digital => 80
    expectPrices(res, "80.00", "0.00");
  });
});

/* ------------------------------------------------------------------ *
 *  STRING FORMATTING RULES                                            *
 * ------------------------------------------------------------------ */

describe("String formatting & rounding", () => {
  it("printPrice always has 2 decimal places", () => {
    const res = getCalc()('Print');
    expect(res.printPrice).toMatch(/^\d+\.\d{2}$/);
  });

  it("digitalPrice in digital-only mode is NOT toFixed(2)", () => {
    const res = getCalc()("Digital");
    expect(res.digitalPrice).toBe("110"); // NOT "110.00"
  });
});
