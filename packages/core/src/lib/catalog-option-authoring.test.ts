import {
  optionBelongsToOrganization,
  previewOptionCombinations,
  printSizeKey,
  validateOptionGroupDrafts,
  validatePrintSizeDrafts,
} from './catalog-option-authoring';

describe('universal option authoring', () => {
  test('accepts multiple reusable option groups', () => {
    const result = validateOptionGroupDrafts([
      { name: ' Size ', values: ['8 × 10 in', '11 × 14 in', '16 × 20 in'] },
      { name: 'Paper', values: ['Matte', 'Fine Art Cotton Rag'] },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value[0].name).toBe('Size');
  });

  test('rejects duplicate option names and choices ignoring case and spaces', () => {
    const result = validateOptionGroupDrafts([
      { name: 'Size', values: ['Matte', '  matte  '] },
      { name: ' size ', values: ['Large'] },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.filter(e => e.code === 'DUPLICATE')).toHaveLength(2);
  });

  test('rejects empty choice groups', () => {
    const result = validateOptionGroupDrafts([{ name: 'Size', values: [] }]);
    expect(result.ok).toBe(false);
  });

  test('generates combinations without touching stock/pricing', () => {
    const result = previewOptionCombinations([
      { name: 'Size', values: ['Small', 'Large'] },
      { name: 'Frame', values: ['None', 'Black', 'White'] },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(6);
      expect(result.value[0].choices).toEqual([
        { groupKey: 'size', valueKey: 'small' },
        { groupKey: 'frame', valueKey: 'none' },
      ]);
    }
  });

  test('rejects combinatorial explosions before allocation', () => {
    const result = previewOptionCombinations([
      { name: 'Size', values: Array.from({ length: 40 }, (_, i) => `Size${i}`) },
      { name: 'Frame', values: Array.from({ length: 40 }, (_, i) => `Frame${i}`) },
    ], 250);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].code).toBe('TOO_MANY_COMBINATIONS');
  });

  test('supports unlimited size choices in validation (not a global size cap)', () => {
    const result = validateOptionGroupDrafts([{ name: 'Size', values: Array.from({ length: 500 }, (_, i) => `Size ${i + 1}`) }]);
    expect(result.ok).toBe(true);
  });

  test('validates individual print size prices and inventory', () => {
    const result = validatePrintSizeDrafts([
      { width: 8, height: 10, unit: 'in', priceMinor: 2500, stock: 20, sku: 'PRINT-8X10' },
      { width: 11, height: 14, unit: 'in', priceMinor: 4000, stock: 15, sku: 'PRINT-11X14' },
      { width: 16, height: 20, unit: 'in', priceMinor: 6500, stock: 10, sku: 'PRINT-16X20' },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(3);
      expect(result.value[2].label).toBe('16 × 20 in');
    }
  });

  test('detects 8x10 and 10x8 as the same dimensions', () => {
    expect(printSizeKey(8, 10, 'in')).toBe(printSizeKey(10, 8, 'in'));
    const result = validatePrintSizeDrafts([
      { width: 8, height: 10, unit: 'in', priceMinor: 2000 },
      { width: 10, height: 8, unit: 'in', priceMinor: 2500 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some(e => e.code === 'DUPLICATE')).toBe(true);
  });

  test('does not incorrectly treat inches and centimeters as identical sizes', () => {
    const result = validatePrintSizeDrafts([
      { width: 8, height: 10, unit: 'in', priceMinor: 2000 },
      { width: 8, height: 10, unit: 'cm', priceMinor: 2500 },
    ]);
    expect(result.ok).toBe(true);
  });

  test('rejects fractional stock and fractional minor-unit prices', () => {
    const result = validatePrintSizeDrafts([
      { width: 8, height: 10, unit: 'in', priceMinor: 2500.5, stock: 1.2 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some(e => e.code === 'INVALID_PRICE')).toBe(true);
      expect(result.errors.some(e => e.code === 'INVALID_STOCK')).toBe(true);
    }
  });

  test('rejects negative stock and prices', () => {
    const result = validatePrintSizeDrafts([{ width: 8, height: 10, unit: 'in', priceMinor: -1, stock: -2 }]);
    expect(result.ok).toBe(false);
  });

  test('rejects duplicate SKU ignoring case', () => {
    const result = validatePrintSizeDrafts([
      { width: 8, height: 10, unit: 'in', priceMinor: 2500, sku: ' PRINT-1 ' },
      { width: 11, height: 14, unit: 'in', priceMinor: 4000, sku: 'print-1' },
    ]);
    expect(result.ok).toBe(false);
  });

  test('does not permit unauthorized option group cross-tenant links', () => {
    expect(optionBelongsToOrganization('org-a', { organizationId: 'org-a' })).toBe(true);
    expect(optionBelongsToOrganization('org-a', { organizationId: 'org-b' })).toBe(false);
    expect(optionBelongsToOrganization('', { organizationId: '' })).toBe(false);
  });

  test('rejects nonfinite or overly precise dimensions', () => {
    const result = validatePrintSizeDrafts([
      { width: Number.POSITIVE_INFINITY, height: 10, unit: 'in', priceMinor: 2000 },
      { width: 8.12345, height: 10, unit: 'in', priceMinor: 2000 },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.filter(e => e.code === 'INVALID_FORMAT')).toHaveLength(2);
  });
});
