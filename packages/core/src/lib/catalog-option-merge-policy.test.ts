import { validateNewOptionChoices } from './catalog-option-merge-policy';

describe('v39D.2 merchant option merge policy', () => {
  test('allows adding multiple unique print sizes to a stored group', () => {
    const result = validateNewOptionChoices('Print size', ['16 × 20 in', '24 × 36 in'], new Set(['8 × 10 in']));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.map(v => v.key)).toEqual(['16 × 20 in', '24 × 36 in']);
  });
  test('rejects a previously stored choice case-insensitively', () => {
    const result = validateNewOptionChoices('Paper', ['  MATTE  '], new Set(['matte']));
    expect(result.ok).toBe(false);
  });
  test('rejects duplicate choices in one submission', () => {
    const result = validateNewOptionChoices('Frame', ['Black', ' black  '], new Set());
    expect(result.ok).toBe(false);
  });
  test('rejects empty selection', () => {
    const result = validateNewOptionChoices('Frame', [], new Set());
    expect(result.ok).toBe(false);
  });
});
