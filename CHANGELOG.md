# 0.1.1
* Correctly initialize field value

# 0.1.0
* Add `{form,field}.empty` methods.

# 0.0.17
* 0.0.16 v2. Convert value to a plain javascript object before doing the comparison

# 0.0.16
* `{form,node}.isDirty` now correctly identify dirty arrays/objects

# 0.0.15
* add `clean` method to Fields and Forms to allow dirty checking against current values

# 0.0.14
* Fix issue with preserving already invalid fields when validating a field subset

# 0.0.13
* Validating a field should also include fields which are currently invalid

# 0.0.12
* Clear validation errors on form reset

# 0.0.11
* Fix mobx peer dependency minimum

# 0.0.10
* ValidatorJS rules need to be converted to plain JS

# 0.0.9
* Fix validatorJS rules existance check

# 0.0.8
* When using validatorJS validator, skip fields that do not have validation rules defined

# 0.0.7
* Function validator now looks for `validator` instead of `validate` to not clash with the per field validate method

# 0.0.6
* Add support for validating subsets of the form.

# 0.0.5
* Updated duti

# 0.0.4
* Add mobx and futil to externals

# 0.0.3
* Remove `async` function declaration to avoid regenerator runtime / babel-polyfill

# 0.0.2
* Fix entry point to use built version

# 0.0.1
* Initial Commit
