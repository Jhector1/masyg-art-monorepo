/**
 * v39D.1 - Universal option authoring validation (non-persistent).
 *
 * This module intentionally does not change ProductVariant, pricing, inventory,
 * tax, checkout, or the catalog schema. Merchant APIs must independently check
 * authorization and organization/product/offering ownership before persisting.
 */

export type OptionAuthoringErrorCode =
  | 'REQUIRED'
  | 'INVALID_FORMAT'
  | 'DUPLICATE'
  | 'OUT_OF_RANGE'
  | 'INVALID_PRICE'
  | 'INVALID_STOCK'
  | 'TOO_MANY_COMBINATIONS';

export interface OptionAuthoringError {
  readonly field: string;
  readonly code: OptionAuthoringErrorCode;
  readonly message: string;
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T; readonly errors: readonly [] }
  | { readonly ok: false; readonly errors: readonly OptionAuthoringError[]; readonly value?: never };

export interface OptionGroupDraft {
  readonly name: string;
  readonly values: readonly string[];
}

export interface NormalizedOptionValue {
  readonly label: string;
  readonly key: string;
}

export interface NormalizedOptionGroup {
  readonly name: string;
  readonly key: string;
  readonly values: readonly NormalizedOptionValue[];
}

const clean = (value: string): string => value.trim().replace(/\s+/gu, ' ');
const keyOf = (value: string): string => clean(value).toLocaleLowerCase('en-US');

/** Validate shared option definitions such as Size, Paper, Frame, Grind and Color. */
export function validateOptionGroupDrafts(
  groups: readonly OptionGroupDraft[],
): ValidationResult<readonly NormalizedOptionGroup[]> {
  const errors: OptionAuthoringError[] = [];
  const names = new Set<string>();
  const result: NormalizedOptionGroup[] = [];

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const group = groups[groupIndex];
    const path = `groups[${groupIndex}]`;
    if (!group || typeof group.name !== 'string' || !Array.isArray(group.values)) {
      errors.push({ field: path, code: 'INVALID_FORMAT', message: 'Each group needs a name and values array.' });
      continue;
    }
    const name = clean(group.name);
    const key = keyOf(group.name);
    if (!name || name.length > 80) {
      errors.push({ field: `${path}.name`, code: name ? 'OUT_OF_RANGE' : 'REQUIRED', message: 'Group name must contain 1–80 characters.' });
    } else if (names.has(key)) {
      errors.push({ field: `${path}.name`, code: 'DUPLICATE', message: 'Option group names must be unique.' });
    } else {
      names.add(key);
    }

    const valueKeys = new Set<string>();
    const values: NormalizedOptionValue[] = [];
    if (group.values.length === 0) {
      errors.push({ field: `${path}.values`, code: 'REQUIRED', message: 'Add at least one choice.' });
    }
    for (let valueIndex = 0; valueIndex < group.values.length; valueIndex++) {
      const raw = group.values[valueIndex];
      const field = `${path}.values[${valueIndex}]`;
      if (typeof raw !== 'string') {
        errors.push({ field, code: 'INVALID_FORMAT', message: 'Choice labels must be strings.' });
        continue;
      }
      const label = clean(raw);
      const valueKey = keyOf(raw);
      if (!label || label.length > 100) {
        errors.push({ field, code: label ? 'OUT_OF_RANGE' : 'REQUIRED', message: 'Choice label must contain 1–100 characters.' });
      } else if (valueKeys.has(valueKey)) {
        errors.push({ field, code: 'DUPLICATE', message: 'Each choice must be unique within its group.' });
      } else {
        valueKeys.add(valueKey);
        values.push({ label, key: valueKey });
      }
    }
    result.push({ name, key, values });
  }

  return errors.length ? { ok: false, errors } : { ok: true, value: result, errors: [] };
}

export type PrintDimensionUnit = 'in' | 'cm';

/**
 * Prices and stock here are **draft input only**. They must map to the existing
 * ProductVariant and its inventory records, never to a parallel stock ledger.
 */
export interface PrintSizeDraft {
  readonly width: number;
  readonly height: number;
  readonly unit: PrintDimensionUnit;
  readonly label?: string;
  readonly priceMinor: number;
  readonly sku?: string;
  readonly stock?: number | null;
}

export interface NormalizedPrintSize {
  readonly key: string;
  readonly width: number;
  readonly height: number;
  readonly unit: PrintDimensionUnit;
  readonly label: string;
  readonly priceMinor: number;
  readonly sku: string | null;
  readonly stock: number | null;
}

function dimensionValid(n: number): boolean {
  // Thousandth-unit precision is enough for print sizes; not arbitrary floating point.
  return typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 10000 &&
    Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-7;
}

function dimensionText(n: number): string {
  return Number(n.toFixed(3)).toString();
}

/** 8×10 and 10×8 are the same paper dimensions; orientation belongs elsewhere. */
export function printSizeKey(width: number, height: number, unit: PrintDimensionUnit): string {
  if (!dimensionValid(width) || !dimensionValid(height) || (unit !== 'in' && unit !== 'cm')) {
    throw new Error('Invalid print dimensions');
  }
  const dims = [Math.round(width * 1000), Math.round(height * 1000)].sort((a, b) => a - b);
  return `${unit}:${dims[0]}x${dims[1]}`;
}

export function validatePrintSizeDrafts(
  sizes: readonly PrintSizeDraft[],
): ValidationResult<readonly NormalizedPrintSize[]> {
  const errors: OptionAuthoringError[] = [];
  const seenDimensions = new Set<string>();
  const seenLabels = new Set<string>();
  const seenSku = new Set<string>();
  const normalized: NormalizedPrintSize[] = [];

  if (sizes.length === 0) {
    errors.push({ field: 'sizes', code: 'REQUIRED', message: 'Add at least one print size.' });
  }

  for (let index = 0; index < sizes.length; index++) {
    const entry = sizes[index];
    const path = `sizes[${index}]`;
    if (!entry || !dimensionValid(entry.width) || !dimensionValid(entry.height) ||
        (entry.unit !== 'in' && entry.unit !== 'cm')) {
      errors.push({ field: path, code: 'INVALID_FORMAT', message: 'Specify positive width and height (up to 3 decimals), in or cm.' });
      continue;
    }
    const key = printSizeKey(entry.width, entry.height, entry.unit);
    if (seenDimensions.has(key)) {
      errors.push({ field: `${path}.width`, code: 'DUPLICATE', message: 'That print size already exists (including reversed dimensions).' });
    }
    seenDimensions.add(key);

    const label = entry.label === undefined
      ? `${dimensionText(entry.width)} × ${dimensionText(entry.height)} ${entry.unit}`
      : typeof entry.label === 'string' ? clean(entry.label) : '';
    const labelKey = keyOf(label);
    if (!label || label.length > 100) {
      errors.push({ field: `${path}.label`, code: label ? 'OUT_OF_RANGE' : 'REQUIRED', message: 'Print size label must contain 1–100 characters.' });
    } else if (seenLabels.has(labelKey)) {
      errors.push({ field: `${path}.label`, code: 'DUPLICATE', message: 'Print size labels must be unique.' });
    }
    seenLabels.add(labelKey);

    if (!Number.isSafeInteger(entry.priceMinor) || entry.priceMinor < 0) {
      errors.push({ field: `${path}.priceMinor`, code: 'INVALID_PRICE', message: 'Price must be a nonnegative integer in minor currency units.' });
    }
    if (entry.stock !== undefined && entry.stock !== null &&
      (!Number.isSafeInteger(entry.stock) || entry.stock < 0)) {
      errors.push({ field: `${path}.stock`, code: 'INVALID_STOCK', message: 'Stock must be a nonnegative integer or null when untracked.' });
    }
    const sku = entry.sku === undefined ? null : typeof entry.sku === 'string' ? clean(entry.sku) : null;
    if (entry.sku !== undefined && (sku === null || sku.length > 100)) {
      errors.push({ field: `${path}.sku`, code: 'INVALID_FORMAT', message: 'SKU must be a string of at most 100 characters.' });
    }
    if (sku) {
      const skuKey = keyOf(sku);
      if (seenSku.has(skuKey)) {
        errors.push({ field: `${path}.sku`, code: 'DUPLICATE', message: 'SKU must be unique within the submitted sizes.' });
      }
      seenSku.add(skuKey);
    }
    normalized.push({
      key, width: entry.width, height: entry.height, unit: entry.unit, label,
      priceMinor: entry.priceMinor, sku, stock: entry.stock ?? null,
    });
  }

  return errors.length ? { ok: false, errors } : { ok: true, value: normalized, errors: [] };
}

export interface OptionCombination {
  readonly choices: readonly { readonly groupKey: string; readonly valueKey: string }[];
}

/**
 * Preview possible combinations for an editor. No cart/checkout/pricing effects.
 * A caller-provided limit protects merchants from accidental combinatorial blow-up.
 */
export function previewOptionCombinations(
  groups: readonly OptionGroupDraft[],
  maxCombinations = 250,
): ValidationResult<readonly OptionCombination[]> {
  const validation = validateOptionGroupDrafts(groups);
  if (!validation.ok) return { ok: false, errors: validation.errors };
  if (!Number.isSafeInteger(maxCombinations) || maxCombinations < 1) {
    return { ok: false, errors: [{ field: 'maxCombinations', code: 'OUT_OF_RANGE', message: 'Combination preview limit must be a positive integer.' }] };
  }

  // Count safely *before* allocating a Cartesian product.
  let count = 1;
  for (const group of validation.value) {
    if (group.values.length > maxCombinations / count) {
      return { ok: false, errors: [{ field: 'groups', code: 'TOO_MANY_COMBINATIONS', message: `Option choices exceed the preview limit of ${maxCombinations}.` }] };
    }
    count *= group.values.length;
  }

  let combos: OptionCombination[] = [{ choices: [] }];
  for (const group of validation.value) {
    const next: OptionCombination[] = [];
    for (const existing of combos) {
      for (const value of group.values) {
        next.push({ choices: [...existing.choices, { groupKey: group.key, valueKey: value.key }] });
      }
    }
    combos = next;
  }
  return { ok: true, value: combos, errors: [] };
}

/**
 * Check a relationship before persistence. Does not replace the database's
 * tenant-scoped composite foreign keys or authenticated server authorization.
 */
export function optionBelongsToOrganization(
  targetOrganizationId: string,
  optionGroup: { readonly organizationId: string },
): boolean {
  return !!targetOrganizationId && optionGroup.organizationId === targetOrganizationId;
}
