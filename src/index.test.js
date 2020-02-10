import F from 'futil'
import _ from 'lodash/fp'
import Form from './index.js'

describe('Array fields', () => {
  let form = null

  beforeEach(() => {
    form = Form({
      fields: {
        addresses: {
          arrayFields: {
            name: {
              label: 'Name',
              validator: () => 'Field "name" is invalid',
            },
          },
          validator: () => 'Field "addresses" is invalid',
          value: [{ name: 'Meridian' }],
        },
      },
    })
  })

  it('Adds nested fields with correct values', () => {
    expect(_.has('0.name', form.fields.addresses.fields)).toBe(true)
    expect(form.fields.addresses.fields['0.name'].value).toBe(
      form.fields.addresses.value[0].name
    )
  })

  it('It adds new field', () => {
    form.fields.addresses.add({ name: 'Washington' })
    expect(form.fields.addresses.value).toEqual([
      { name: 'Meridian' },
      { name: 'Washington' },
    ])
    expect(_.has('1.name', form.fields.addresses.fields)).toBe(true)
    expect(form.fields.addresses.fields['1.name'].value).toBe('Washington')
  })

  it('It removes field by index', () => {
    form.fields.addresses.add({ name: 'Washington' })
    form.fields.addresses.removeIndex(0)
    expect(form.fields.addresses.value).toEqual([{ name: 'Washington' }])
    expect(_.has('1.name', form.fields.addresses.fields)).toBe(false)
    expect(form.fields.addresses.fields['0.name'].value).toBe('Washington')
  })

  it('It removes field by value', () => {
    form.fields.addresses.add({ name: 'Washington' })
    form.fields.addresses.remove({ name: 'Meridian' })
    expect(form.fields.addresses.value).toEqual([{ name: 'Washington' }])
    expect(_.has('1.name', form.fields.addresses.fields)).toBe(false)
    expect(form.fields.addresses.fields['0.name'].value).toBe('Washington')
  })

  it('Two-way binding between nested field value and parent value', () => {
    let child = form.fields.addresses.fields['0.name']
    let parent = form.fields.addresses.value[0]
    child.value = 'Washington'
    expect(parent.name).toBe(child.value)
    parent.name = 'Meridian'
    expect(child.value).toBe(parent.name)
  })

  it('Gotcha: Does not sync subfields on replacing entire array', () => {
    let before = form.fields.addresses.fields
    form.fields.addresses.value = [{ name: 'New' }]
    expect(before).toEqual(form.fields.addresses.fields)
  })

  it('Gotcha: Does not sync subfields on mutating array', () => {
    let before = form.fields.addresses.fields
    form.fields.addresses.value.push({ name: 'New' })
    expect(before).toEqual(form.fields.addresses.fields)
  })

  it('Gotcha: Does not sync subfield on adding new property to array item', () => {
    form.fields.addresses.value[0].state = 'Florida'
    expect(_.has('0.state', form.fields.addresses.fields)).toBe(false)
  })

  describe('Field attributes', () => {
    let field = null

    beforeEach(() => {
      field = form.fields.addresses.fields['0.name']
    })

    it('errors | isValid', () => {
      expect(field.errors).toEqual([])
      expect(field.isValid).toEqual(true)
      field.validate()
      expect(field.errors).toEqual('Field "name" is invalid')
      expect(field.isValid).toEqual(false)
    })

    it('isDirty', () => {
      expect(field.isDirty).toEqual(false)
      field.value = 'New'
      expect(field.isDirty).toEqual(true)
    })

    it('reset()', () => {
      field.value = 'New'
      field.reset()
      expect(field.value).toEqual('Meridian')
    })

    it('validate()', () => {
      expect(field.validate()).toEqual({
        'addresses.0.name': 'Field "name" is invalid',
      })
    })

    it('clean()', () => {
      expect(form.isDirty).toEqual(false)
      field.value = 'New'
      expect(field.isDirty).toEqual(true)
      field.clean()
      expect(field.isDirty).toEqual(false)
    })
  })

  describe('Form attributes', () => {
    it('flatFields', () => {
      expect(_.keys(form.flatFields)).toEqual(['addresses', 'addresses.0.name'])
    })

    it('getSnapshot()', () => {
      expect(form.getSnapshot()).toEqual({
        'addresses.0.name': 'Meridian',
      })
    })

    it('getNestedSnapshot()', () => {
      expect(form.getNestedSnapshot()).toEqual({
        addresses: [{ name: 'Meridian' }],
      })
    })

    it('getPatch()', () => {
      form.fields.addresses.add({ name: 'Washington' })
      expect(form.getPatch()).toEqual({ 'addresses.1.name': 'Washington' })
      form.fields.addresses.fields['0.name'].value = 'Jefferson'
      expect(form.getPatch()).toEqual({
        'addresses.0.name': 'Jefferson',
        'addresses.1.name': 'Washington',
      })
      form.clean()
      expect(form.getPatch()).toEqual({})
    })

    it('reset()', () => {
      form.fields.addresses.fields['0.name'].value = 'New'
      form.reset()
      expect(form.fields.addresses.fields['0.name'].value).toBe('Meridian')
    })

    it('isDirty', () => {
      expect(form.isDirty).toBe(false)
      form.fields.addresses.fields['0.name'].value = 'New'
      expect(form.isDirty).toBe(true)
      form.reset()
      expect(form.isDirty).toBe(false)
    })

    it('clean()', () => {
      expect(form.isDirty).toBe(false)
      form.fields.addresses.fields['0.name'].value = 'New'
      expect(form.isDirty).toBe(true)
      form.clean()
      expect(form.isDirty).toBe(false)
    })

    it('validate() | isValid', () => {
      expect(form.isValid).toBe(true)
      expect(form.validate()).toEqual({
        addresses: 'Field "addresses" is invalid',
        'addresses.0.name': 'Field "name" is invalid',
      })
      expect(form.isValid).toBe(false)
    })
  })
})
