/** Pure print variant identity rules shared by the UI, API and persistence. */
import { printSizeKey, type PrintDimensionUnit } from './catalog-option-authoring';

const norm = (value: string) => value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');

export type PrintConfiguration = { material: string; finish: string; frame: string; glazing: string };
export type PrintBatchSize = { width: number; height: number; unit: PrintDimensionUnit; sku: string; priceMinor: number; stock: number; compareAtMinor?: number };

/** The orientation is not part of a physical paper size identity. */
export function printConfigurationKey(sizeKey: string, option: PrintConfiguration): string {
  return [sizeKey, norm(option.material), norm(option.finish), norm(option.frame), norm(option.glazing)].join('|');
}

/** Read old physical variants without trusting free-form JSON attributes. */
export function existingPrintConfigurationKey(attributes: unknown): string | null {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return null;
  const data = attributes as Record<string, unknown>;
  if (typeof data.size !== 'string') return null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(in|inches|inch|cm)\s*$/iu.exec(data.size);
  if (!m) return null;
  let dimensionKey: string;
  try { dimensionKey = printSizeKey(Number(m[1]), Number(m[2]), m[3].toLowerCase().startsWith('in') ? 'in' : 'cm'); }
  catch { return null; }
  return printConfigurationKey(dimensionKey, {
    material: typeof data.material === 'string' ? data.material : '',
    finish: typeof data.finish === 'string' ? data.finish : '',
    frame: typeof data.frame === 'string' ? data.frame : '',
    glazing: typeof data.glazing === 'string' ? data.glazing : '',
  });
}

export function normalizePrintSku(sku: string): string { return sku.trim().toUpperCase(); }

/** Validate one atomic group, not a global restriction on how many sizes a merchant owns. */
export function validatePrintBatch(
  sizes: readonly PrintBatchSize[],
  existingConfigurations: ReadonlySet<string>,
  options: PrintConfiguration,
): string[] {
  const errors: string[] = [];
  const configurations = new Set<string>();
  const skus = new Set<string>();
  for (const [i, size] of sizes.entries()) {
    const line = `Size ${i + 1}`;
    let key: string;
    try { key = printSizeKey(size.width, size.height, size.unit); }
    catch { errors.push(`${line}: invalid dimensions or unit`); continue; }
    const config = printConfigurationKey(key, options);
    if (configurations.has(config) || existingConfigurations.has(config)) errors.push(`${line}: this exact size, material, finish, frame and glazing already exists`);
    configurations.add(config);
    const sku = normalizePrintSku(size.sku);
    if (!/^[A-Z0-9][A-Z0-9._-]{0,99}$/.test(sku)) errors.push(`${line}: SKU must be 1–100 letters, digits, hyphens, underscores or periods`);
    if (skus.has(sku)) errors.push(`${line}: duplicate SKU in this group`);
    skus.add(sku);
    if (!Number.isSafeInteger(size.priceMinor) || size.priceMinor < 0 || size.priceMinor > 2147483647) errors.push(`${line}: invalid price`);
    if (size.compareAtMinor !== undefined && (!Number.isSafeInteger(size.compareAtMinor) || size.compareAtMinor <= size.priceMinor || size.compareAtMinor > 2147483647)) errors.push(`${line}: regular price must exceed the selling price`);
    if (!Number.isSafeInteger(size.stock) || size.stock < 0 || size.stock > 2147483647) errors.push(`${line}: stock must be a nonnegative whole number`);
  }
  return errors;
}
