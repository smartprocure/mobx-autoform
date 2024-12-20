# 0.14.3

- FIX: On removing an array item, corresponding errors must also be spliced.

# 0.14.2

- FIX: remove() removes all errors, not just the removed field.

# 0.14.1

- FIX: errors[''] is nothing special, remove special handling for it.

# 0.14.0

- Support form errors via an `ValidationError` on `submit`.

# 0.13.2

- Do not extend submit when already present

# 0.13.1

- Use yarn and esbuild

# 0.13.0

- Compatibility with mobx>=4

# 0.12.0

- Support overriding `getPatch`

# 0.11.0

- Support overriding `getSnapshot` and `getNestedSnapshot`

# 0.10.0

- Support a JSON schema definition for the form

# 0.9.1

- Do not add a default `fields` property on array fields.

# 0.9.0

- Allow for data-testid on form elements. If no identifier is passed "unknown" will be assumed as the namespace

# 0.8.0

- Set submit error state to null after validation has occurred

# 0.7.1

- set value default to an empty object

# 0.7.0

- Pass `form` to validator function

# 0.6.0

- Add `label` to the form

# 0.5.0

- Add path to node

# 0.4.3

- Detect field removals on `getPatch()`

# 0.4.2

- Bugfix: Unflatten all fields on `F.getNestedSnapshot`

# 0.4.1

- Bugfix: Use safe clone instead of `_.cloneDeep` internally

# 0.4.0

- Do not take `path` on `node.remove`. Use `form.getField(path).remove()`
- Make sure array fields are observables when replacing array values

# 0.3.0

- Add nested fields support
- Add array fields support
- Drop `{form,field}.empty` methods.

# 0.2.0

- Export validators

# 0.1.4

- Chore: drop webpack

# 0.1.3

- Chore: package bumps

# 0.1.2

- Correctly initialize field value

# 0.1.1

- 0.0.16 v3. Convert other value to a plain javascript object before doing the comparison

# 0.1.0

- Add `{form,field}.empty` methods.

# 0.0.17

- 0.0.16 v2. Convert value to a plain javascript object before doing the comparison

# 0.0.16

- `{form,node}.isDirty` now correctly identify dirty arrays/objects

# 0.0.15

- add `clean` method to Fields and Forms to allow dirty checking against current values

# 0.0.14

- Fix issue with preserving already invalid fields when validating a field subset

# 0.0.13

- Validating a field should also include fields which are currently invalid

# 0.0.12

- Clear validation errors on form reset

# 0.0.11

- Fix mobx peer dependency minimum

# 0.0.10

- ValidatorJS rules need to be converted to plain JS

# 0.0.9

- Fix validatorJS rules existance check

# 0.0.8

- When using validatorJS validator, skip fields that do not have validation rules defined

# 0.0.7

- Function validator now looks for `validator` instead of `validate` to not clash with the per field validate method

# 0.0.6

- Add support for validating subsets of the form.

# 0.0.5

- Updated duti

# 0.0.4

- Add mobx and futil to externals

# 0.0.3

- Remove `async` function declaration to avoid regenerator runtime / babel-polyfill

# 0.0.2

- Fix entry point to use built version

# 0.0.1

- Initial Commit
