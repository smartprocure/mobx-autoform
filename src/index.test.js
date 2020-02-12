import Form from './index.js'
import _ from 'lodash/fp'

require('util').inspect.defaultOptions.depth = null

describe('Form', () => {
  let form = null
  let fields = {
    location: {
      fields: {
        'country.state': {
          fields: {
            zip: {
              validator: () => 'Invalid zip',
            },
          },
        },
        addresses: {
          items: {
            street: {},
            tenants: {
              items: {
                name: { validator: () => 'Invalid name' },
                age: {},
              },
            },
          },
        },
      },
      value: {
        'country.state': { zip: '07016' },
        addresses: [{ street: 'Meridian', tenants: [{ name: 'John' }] }],
      },
    },
  }

  beforeEach(() => {
    form = Form({ fields })
  })

  it('Initialize nested fields with correct values', () => {
    let path = 'location.addresses.0.street'
    let street = form.getField(path)
    expect(street).not.toBeUndefined()
    expect(street.value).toBe(form.getValue(path))

    path = 'location.addresses.0.tenants.0.name'
    let name = form.getField(path)
    expect(name).not.toBeUndefined()
    expect(name.value).toBe(form.getValue(path))

    path = ['location', 'country.state', 'zip']
    let zip = form.getField(path)
    expect(zip).not.toBeUndefined()
    expect(zip.value).toBe(form.getValue(path))
  })

  it('Two-way binding between nested field value and parent value', () => {
    let path = 'location.addresses.0.tenants.0'
    let name = form.getField(`${path}.name`)
    let parent = form.getValue(path)
    name.value = 'Alex'
    expect(parent.name).toBe(name.value)
    parent.name = 'Meridian'
    expect(name.value).toBe(parent.name)
  })

  it('Add new array field', () => {
    let addresses = form.getField('location.addresses')
    addresses.add({ street: 'Washington' })
    expect(
      _.find({ street: 'Washington' }, addresses.value)
    ).not.toBeUndefined()
    expect(addresses.getField('1.street')).not.toBeUndefined()
  })

  it('Add new nested array field', () => {
    let addresses = form.getField('location.addresses')
    let value = { tenants: [{ name: 'Paul' }] }
    addresses.add(value)
    expect(_.find(value, addresses.value)).not.toBeUndefined()
    expect(addresses.getField('1.tenants.0.name')).not.toBeUndefined
  })

  it('Add new object field', () => {
    let state = form.getField('location."country.state"')
    state.add({ someField: { value: 'Florida' } })
    expect(state.value).toEqual({
      zip: '07016',
      someField: 'Florida',
    })
    expect(state.getField('someField')).not.toBeUndefined()
  })

  it.skip('Remove array field by index', () => {
    let addresses = form.getField('location.addresses')
    addresses.add({ street: 'Washington' })
    addresses.remove(0)
    expect(addresses.value).toEqual([{ street: 'Washington' }])
    expect(addresses.fields.length).toBe(1)
    expect(_.get('0.street', addresses.value)).toBe('Washington')
  })

  it.skip('Remove array field by value', () => {
    let addresses = form.getField('location.addresses')
    addresses.add({ street: 'Washington' })
    addresses.remove(addresses.fields[0])
    expect(addresses.value).toEqual([{ street: 'Washington' }])
    expect(addresses.fields.length).toBe(1)
    expect(_.get('0.street', addresses.value)).toBe('Washington')
  })

  it.skip('Remove field by path', () => {
    let addresses = form.getField('location.addresses')
    addresses.add({ tenants: [{ name: 'Paul', age: 53 }] })
    addresses.remove('1.tenants.0.name')
    expect(
      _.find({ tenants: [{ age: 53 }] }, addresses.value)
    ).not.toBeUndefined()
    expect(addresses.getField('1.tenants')).not.toBeUndefined()
  })

  describe('Field attributes', () => {
    let name = null

    beforeEach(() => {
      name = form.getField('location.addresses.0.tenants.0.name')
    })

    it('errors | isValid', () => {
      expect(name.errors).toEqual([])
      expect(name.isValid).toEqual(true)
      name.validate()
      expect(name.errors).toEqual('Invalid name')
      expect(name.isValid).toEqual(false)
    })

    it('isDirty', () => {
      expect(name.isDirty).toEqual(false)
      name.value = 'New'
      expect(name.isDirty).toEqual(true)
    })

    it('reset()', () => {
      // Resets value
      expect(name.isDirty).toEqual(false)
      name.value = 'New'
      expect(name.isDirty).toEqual(true)
      name.reset()
      expect(name.isDirty).toEqual(false)
      expect(name.value).toEqual('John')

      // Resets subfields
      let street = form.getField('location.addresses.0.street')
      street.add({ newField: { label: 'New name' } })
      expect(street.getField('newField')).not.toBeUndefined()
      street.reset()
      expect(street.isDirty).toEqual(false)
      expect(street.getField('newField')).toBeUndefined()

      // Resets array subfields
      let addresses = form.getField('location.addresses')
      addresses.add({ street: 'Laurence' })
      addresses.reset()
      expect(addresses.isDirty).toEqual(false)
      expect(addresses.fields.length).toBe(1)
      expect(addresses.getField('0.street').value).toBe('Meridian')
      expect(addresses.value).toEqual([
        { street: 'Meridian', tenants: [{ name: 'John' }] },
      ])
    })

    it('validate()', () => {
      expect(name.validate()).toEqual({
        'location.addresses.0.tenants.0.name': 'Invalid name',
      })
    })

    it('clean()', () => {
      expect(name.isDirty).toEqual(false)
      name.value = 'New'
      expect(name.isDirty).toEqual(true)
      name.clean()
      expect(name.isDirty).toEqual(false)
      expect(name.value).toEqual('New')
      name.value = 'John'
      name.clean()

      // Cleans subfields
      let street = form.getField('location.addresses.0.street')
      street.add({ newField: { label: 'New name' } })
      expect(street.getField('newField')).not.toBeUndefined()
      street.clean()
      expect(street.isDirty).toEqual(false)
      expect(street.getField('newField')).not.toBeUndefined()

      // Cleans array subfields
      let addresses = form.getField('location.addresses')
      addresses.add({ street: 'Laurence' })
      addresses.clean()
      expect(addresses.isDirty).toEqual(false)
      expect(addresses.getField('1.street')).not.toBeUndefined()
      expect(addresses.value).toEqual([
        { street: 'Meridian', tenants: [{ name: 'John' }] },
        { street: 'Laurence' },
      ])
    })
  })

  describe('Form attributes', () => {
    it('getSnapshot()', () => {
      expect(form.getSnapshot()).toEqual({
        'location.country.state.zip': '07016',
        'location.addresses.0.street': 'Meridian',
        'location.addresses.0.tenants.0.name': 'John',
      })
    })

    it('getNestedSnapshot()', () => {
      expect(form.getNestedSnapshot()).toEqual({
        location: {
          'country.state': {
            zip: '07016',
          },
          addresses: [
            {
              street: 'Meridian',
              tenants: [{ name: 'John' }],
            },
          ],
        },
      })
      // TODO: Remove field and test snapshot again
    })

    it('getPatch()', () => {
      let addresses = form.getField('location.addresses')
      addresses.add({ street: 'Washington' })
      expect(form.getPatch()).toEqual({
        'location.addresses.1.street': 'Washington',
      })
      addresses.getField('0.street').value = 'Jefferson'
      expect(form.getPatch()).toEqual({
        'location.addresses.0.street': 'Jefferson',
        'location.addresses.1.street': 'Washington',
      })
      form.clean()
      expect(form.getPatch()).toEqual({})
      addresses.getField('0.street').value = 'Jefferson'
      form.reset()
      expect(form.getPatch()).toEqual({})

      let state = form.getField('location."country.state"')
      state.add({ capital: {} })
      expect(form.getPatch()).toEqual({})
      state.getField('capital').value = 'Tallahase'
      expect(form.getPatch()).toEqual({
        'location.country.state.capital': 'Tallahase',
      })
    })

    it('reset()', () => {
      let addresses = form.getField('location.addresses')
      addresses.add({ street: 'New' })
      form.reset()
      expect(addresses.fields.length).toBe(2)
      let street = addresses.getField('0.street')
      street.value = 'New'
      form.reset()
      expect(street.value).toBe('Meridian')
      expect(form.fields.location.value.addresses[0].street).toBe('Meridian')
    })

    it('isDirty', () => {
      expect(form.isDirty).toBe(false)
      form.getField('location.addresses.0.street').value = 'New'
      expect(form.isDirty).toBe(true)
      form.reset()
      expect(form.isDirty).toBe(false)
    })

    it('clean()', () => {
      expect(form.isDirty).toBe(false)
      form.getField('location.addresses.0.street').value = 'New'
      expect(form.isDirty).toBe(true)
      form.clean()
      expect(form.isDirty).toBe(false)
    })

    it('validate() | isValid', () => {
      expect(form.isValid).toBe(true)
      expect(form.validate()).toEqual({
        'location.country.state.zip': 'Invalid zip',
        'location.addresses.0.tenants.0.name': 'Invalid name',
      })
      expect(form.isValid).toBe(false)
    })

    it('add()', () => {
      form.add({ newField: { label: 'New name' } })
      expect(form.getField('newField')).not.toBeUndefined()
    })
  })
})
