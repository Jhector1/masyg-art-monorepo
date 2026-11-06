import { existingPrintConfigurationKey, normalizePrintSku, printConfigurationKey, validatePrintBatch } from './print-size-batch-policy';
import { printSizeKey } from './catalog-option-authoring';

const options = { material: 'Fine art paper', finish: 'Matte', frame: 'Unframed', glazing: 'None' };
const rows = [
  { width: 8, height: 10, unit: 'in' as const, sku: 'PRINT-8X10', priceMinor: 2500, stock: 3 },
  { width: 11, height: 14, unit: 'in' as const, sku: 'PRINT-11X14', priceMinor: 4000, stock: 0 },
];

describe('v39D.3 atomic print size policy', () => {
  test('accepts multiple priced, stocked variants in one authoring batch', () => {
    expect(validatePrintBatch(rows, new Set(), options)).toEqual([]);
  });
  test('rejects identical dimensions in reverse orientation', () => {
    expect(validatePrintBatch([...rows, { ...rows[0], width: 10, height: 8, sku: 'DIFFERENT' }], new Set(), options).join(' ')).toMatch(/already exists/);
  });
  test('rejects exact existing configuration even with case and whitespace changes', () => {
    const known = new Set([printConfigurationKey(printSizeKey(8,10,'in'), {material:' fine  ART paper ',finish:'matte',frame:'UNFRAMED',glazing:'NONE'})]);
    expect(validatePrintBatch(rows, known, options).join(' ')).toMatch(/already exists/);
  });
  test('allows the same size in a different paper/finish configuration', () => {
    const known = new Set([printConfigurationKey(printSizeKey(8,10,'in'), { ...options, finish: 'Glossy' })]);
    expect(validatePrintBatch(rows, known, options)).toEqual([]);
  });
  test('does not conflate centimeters with inches', () => {
    expect(printConfigurationKey(printSizeKey(8, 10, 'in'), options)).not.toBe(printConfigurationKey(printSizeKey(8, 10, 'cm'), options));
  });
  test('blocks repeated SKU ignoring case', () => {
    expect(validatePrintBatch([{...rows[0],sku:'abc'}, {...rows[1],sku:'ABC'}],new Set(),options).join(' ')).toMatch(/duplicate SKU/);
  });
  test('normalizes sku before database persistence', () => {
    expect(normalizePrintSku('  print-art_2 ')).toBe('PRINT-ART_2');
  });
  test('rejects invalid SKU formatting and empty SKU', () => {
    expect(validatePrintBatch([{...rows[0],sku:'foo bar'}],new Set(),options).join(' ')).toMatch(/SKU/);
    expect(validatePrintBatch([{...rows[0],sku:''}],new Set(),options).join(' ')).toMatch(/SKU/);
  });
  test('rejects negative and fractional initial inventory', () => {
    expect(validatePrintBatch([{...rows[0],stock:-1}],new Set(),options).join(' ')).toMatch(/stock/);
    expect(validatePrintBatch([{...rows[0],stock:1.2}],new Set(),options).join(' ')).toMatch(/stock/);
  });
  test('rejects prices beyond the database integer bounds', () => {
    expect(validatePrintBatch([{...rows[0],priceMinor:2147483648}],new Set(),options).join(' ')).toMatch(/price/);
  });
  test('requires compare-at price higher than selling price', () => {
    expect(validatePrintBatch([{...rows[0],compareAtMinor:2500}],new Set(),options).join(' ')).toMatch(/regular price/);
  });
  test('does not silently identify unreadable JSON as a valid printed size', () => {
    expect(existingPrintConfigurationKey(null)).toBeNull();
    expect(existingPrintConfigurationKey({size:'8x10',material:'Art'})).toBeNull();
  });
  test('reads legacy physical variants using inches spelled out', () => {
    expect(existingPrintConfigurationKey({ size:'10 x 8 inches',material:options.material,finish:options.finish,frame:options.frame,glazing:options.glazing }))
      .toBe(printConfigurationKey(printSizeKey(8,10,'in'), options));
  });
  test('limits normalized dimensions to three decimal places', () => {
    expect(validatePrintBatch([{...rows[0],width:8.0001}],new Set(),options).join(' ')).toMatch(/dimensions/);
  });
  test('keeps option combinations separate per frame choice', () => {
    const known = new Set([printConfigurationKey(printSizeKey(8,10,'in'),{...options,frame:'Black wood'})]);
    expect(validatePrintBatch(rows,known,options)).toEqual([]);
  });
});
