# mobx-autoform

Ridiculously simple form state management with mobx.

The general idea is to standardize a structure for observables and computeds that are repeated for every form field, like validation, dirty tracking, etc. It's similar to `createViewModel` from `mobx-utils` but for forms that include validation and not just reset.


# Quick Start Usage

https://stackblitz.com/edit/mobx-autoform


```js
import Form from 'mobx-autoform'
import {reaction} from 'mobx'

let form = Form({
  fields: {
    email: {},
    password: {
      validate: x => !x && ['Password is required'],
    },
  },
  submit: async snapshot => {
	// Throwing here will capture errors
    await serviceCall(snapshot)
  },
})

// Everything is just observables and computeds, use mobx as normal
let emailChanges = 0
reaction(
  () => form.fields.email.value,
  () => emailChanges++
)

// Mutation is straightforward because it's just mobx
form.fields.email.value = 'new@email.com'
// form.fields.email.isDirty == true
// emailChanges == 1
await form.submit()
form.isValid // false
// form.fields.password.errors == ['Password is required']

```

# Why?
We've looked at just about every single form management package for mobx and react. Almost all of them fall apart for various reasons. Some design goals:

- Don't abstract away mobx, it's amazing!
- Support simple integration with any off the shelf component.
- Don't try to automatically provide bindings for every component. Don't introduce new concepts like `BindingRewriters` that some other libs have, just nudge users to leverage `futil`'s `domLens` functions.
- Support a functional style API.
- Stay as radically simple as possible. Philosphically, prefer simple over easy. The entire source is a few dozen lines of code even _after_ prettier has its way with it.
- Be simple to extend by just leveraging `mobx`.


# API

## Form Config
`Form` takes an object with the following properties:

| Props | Description |
| ----- | ----------- |
| `fields` | An object whose keys are the field paths and value is a field config object. Anything passed in will be made an observable. Required. |
| `submit(snapshot, form)` | An async function that gets called if validation passes when calling `form.submit`. Required. |
| `validate(form) -> {field: [errors]}` | Optional. Allows using alternative validation strategies. Some alternative validators are available out of the box such as support for `validatorjs` rules. |
| `afterInitField(field) -> field` | Optional. Allows hooking into `initField` to add additional properties generically. An example use case would be to support a type based templating of props and is in the demos. |


## Field API
| prop | description |
| ---- | ----------- |
| field | The field key |
| label | The display label, defaults to _.startCase on field |
| value | The field's current value. Will default to `''` if no value is provided. |
| errors | A computed of validation errors for the field |
| isValid | A computed boolean representing if there are errors |
| isDirty | A computed boolean representing if the value has changed since the form was instantiated |
| reset | A method to reset the field back to the value it had when the form was instantiated |

## Form API
| prop | description |
| ---- | ----------- |
| `fields` | The observable fields object |
| `getSnapshot()` | A method which returns an object of all of the field values |
| `getNestedSnapshot()` | Just like `getSnapshot`, but calls F.unflattenObject |
| `getPatch()` | A method which returns a "patch", which is an object of only the field values that have changed since the form was instantiated |
| `submit()` | A futil `Command` method to submit the form, which triggers validation and then calls the submit function passed to Form |
| `submitError` | A computed that pulls the error from the submit Command |
| `reset()` | A method which calls reset on all fields | isDirty | A computed boolean representing if any field isDirty |
| `errors` | An object of field errors |
| `isValid` | A computed boolean representing if any field has errors |
| `validate()` | A method to run the validate function and populates form.errors with the results |
| `add({fields})` | A method to dynamically add fields, which mutates the fields observable and calls initField on all the fields passed in. Takes a object just like the fields object on form. |
| `initField({field})` | The internal method called on each field object passed into the form. Can be used externally to add the default computeds. |

## Usage with `validatorjs`
You can use any validation package, but validatorjs support is provided out of the box:

```js
import Form from 'mobx-autoform'
import {validatorJS} from 'mobx-autoform/validators'
import V from 'validatorjs'

let form = Form({
  fields: {
    email: {
      label: 'Email Address',
      rules: 'required|email'
    },
    password: {
      rules: 'required',
    },
  },
  submit: async snapshot => {
    await serviceCall(snapshot)
  },
  validate: validatorJS(V),
})
```

You can also combine validation strategies with `F.mergeOver`:

```js
import {mergeOver} from 'futil'
import {validatorJS, functions} from 'mobx-autoform/validators'
//...
  validate: mergeOver([validatorJS(V), functions])
//...
```

## Usage with React
`mobx-autoform` pairs well with mobx-react. We recommend authoring wrapper components that take fields as props, and leveraging `futil`'s  `domLens` functions, but keep in mind that you don't _have_ to:

```js
import React from 'react'
import {observer} from 'mobx-react'
import F from 'futil'

export let Input = observer(({ field }) =>
  <input {...{
    ...F.domLens.value('value', field),
	// You can also just use regular props:
    // onChange: e => { field.value = e.target.value},
    // value: field.value,
    
	// mobx-autoform isn't opinionated on what to track - put whatever you want on it!
    ...F.domLens.focus('focusing', field),

	// A common pattern is to pass along props from field config
    ...field.props,

	// You can style conditionally based on validation
    ...!field.isValid && {style: { borderColor: 'red' }},

	// You can even decorate the field with ref methods to expose component methods on the field - with this you could do stuff like `form.fields.email.focus()`
    ref: ref => { field.focus = () => ref.focus() }
  }} />
)
```

### Automatic Layout
Check out the `autoform` file in the demo. The general idea is to put `Component` and `props` properties on fields, and then just map over `form.fields`


## Dynamically Adding Fields
Fields can be dynamically added using `form.add`. Since fields is an observable object, all it really does is simply call `initField` on the values and adds them to the fields object. **Note:** If you need mobx 4 support, make sure to use `values(fields)`  if you're dynamically iterating over fields if you want `observer` to react to new fields being added.

## Arrays of Objects
Arrays of objects are supported by simply adding fields where the index is part of the field name - e.g. `listField.0.name`, `listField.1.name`, etc. You can determine what the next index should be when calling add by checking the `length` of the field on the nested snapshot - e.g. 
```js
let nextIndex  = _.getOr(0, `listField.length`, form.getNestedSnapshot())
```

## Extending the form
`Form` doesn't have any private state, so anything you'd want to extend a form with can generally be done with mobx's `extendObservable` on a form instance - including adding new computed properties.

## Control Methods
Specific components might have an API to do useful things. As mentioned in the example react integration, you can decorate the field with ref methods to expose component methods on the field - with this you could do stuff like `form.fields.email.focus()`

## Loading Spinners
Since `form.submit` is a futil Command, it includes state to tell you if it's currently submitting, and it's status will be success or failure after it runs (automatically reset after 500ms by default). If you're using react, you might build a component to render the submit button like this:

```js
export let CommandButton = observer(({command, children}) => (
  <button onClick={command} disabled={command.state.processing}>
    {_.startCase(command.state.status) || children}
  </button>
))
```
