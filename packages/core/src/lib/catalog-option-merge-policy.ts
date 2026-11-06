import {
  validateOptionGroupDrafts, type NormalizedOptionValue, type OptionAuthoringError,
  type ValidationResult,
} from './catalog-option-authoring';

/** Validate appended option choices against persisted case-insensitive keys. */
export function validateNewOptionChoices(
  groupName: string,
  incoming: readonly string[],
  existingKeys: ReadonlySet<string>,
): ValidationResult<readonly NormalizedOptionValue[]> {
  const validated = validateOptionGroupDrafts([{ name: groupName, values: incoming }]);
  if (!validated.ok) return { ok: false, errors: validated.errors };
  const values = validated.value[0].values;
  const collision = values.find(value => existingKeys.has(value.key));
  if (collision) {
    const error: OptionAuthoringError = {
      field: 'values', code: 'DUPLICATE', message: `Choice "${collision.label}" already exists in this group.`,
    };
    return { ok: false, errors: [error] };
  }
  return { ok: true, value: values, errors: [] };
}
