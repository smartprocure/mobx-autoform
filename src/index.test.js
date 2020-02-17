import { reaction, isObservable, toJS } from 'mobx'
import Form from './index'
import _ from 'lodash/fp'

require('util').inspect.defaultOptions.depth = null

describe('Form', () => {
  let dispose = _.noop
  let form = null

  beforeEach(() => {
    dispose()
    form = Form({
      fields: {
        location: {
          value: {
            'country.state': { zip: '07016' },
            addresses: [{ street: 'Meridian', tenants: ['John'] }],
          },
          fields: {
            'country.state': {
              label: 'Dotted field name',
              fields: {
                zip: {
                  validator: () => 'Invalid zip',
                },
              },
            },
            addresses: {
              label: 'Array field',
              items: {
                label: 'Item field is a record',
                fields: {
                  street: {},
                  tenants: {
                    label: 'Array field',
                    items: {
                      label: 'Item field is a primitive',
                      validator: () => 'Invalid tenant',
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
  })

  it('Initialize nested fields with correct values', () => {
    let path = 'location.addresses.0.street'
    let street = form.getField(path)
    expect(street).not.toBeUndefined()
    expect(street.value).toBe(_.get(path, form.value))
    path = 'location.addresses.0.tenants.0'
    let name = form.getField(path)
    expect(name).not.toBeUndefined()
    expect(name.value).toBe(_.get(path, form.value))
    path = ['location', 'country.state', 'zip']
    let zip = form.getField(path)
    expect(zip).not.toBeUndefined()
    expect(zip.value).toBe(_.get(path, form.value))
  })

  it('Two-way binding between nested field value and parent value', () => {
    let path = 'location.addresses.0.tenants'
    let name = form.getField(`${path}.0`)
    let parent = _.get(path, form.value)
    name.value = 'Alex'
    expect(parent[0]).toBe(name.value)
    parent.name = 'Meridian'
    expect(name.value).toBe(parent[0])
  })

  it('Add new array field', () => {
    let path = 'location.addresses'
    let addresses = form.getField(path)
    let value = { street: 'Washington' }
    addresses.add(value)
    let added = _.last(addresses.value)

    // Value was added correctly
    expect(added).not.toBeUndefined()
    expect(isObservable(added)).toBe(true)
    expect(toJS(added)).toEqual(value)
    expect(_.last(_.get(path, form.value))).toBe(added)

    // Field was added correctly
    let street = form.getField('location.addresses.1.street')
    expect(street).not.toBeUndefined()
    expect(street.value).toBe('Washington')
  })

  it('Add new nested array field', () => {
    let path = 'location.addresses.0.tenants'
    let tenants = form.getField(path)
    let value = 'Paul'
    tenants.add(value)
    let added = _.last(tenants.value)

    // Value was added correctly
    expect(added).not.toBeUndefined()
    expect(added).toEqual(value)
    expect(_.last(_.get(path, form.value))).toBe(added)

    // Field was added correctly
    let name = form.getField(`${path}.1`)
    expect(name).not.toBeUndefined()
    expect(name.value).toBe('Paul')
  })

  it('Add new object field', () => {
    let path = ['location', 'country.state']
    let state = form.getField(path)
    let value = { beach: { value: 'Florida' } }
    state.add(value)
    let added = state.value.beach

    // Value was added correctly
    expect(added).not.toBeUndefined()
    expect(isObservable(added)).toBe(false) // Primitives are not observable
    expect(added).toEqual('Florida')
    expect(_.get(path, form.value).beach).toBe(added)

    // Field was added correctly
    let beach = form.getField(path).getField('beach')
    expect(beach).not.toBeUndefined()
    expect(beach.value).toBe('Florida')
  })

  it('Remove array field', () => {
    let location = form.getField('location')

    // Remove object field
    let path = 'addresses.0.tenants.0'
    expect(location.getField(path)).not.toBeUndefined()
    expect(_.get(path, location.value)).not.toBeUndefined()
    location.remove(path)
    expect(location.getField(path)).toBeUndefined()
    expect(_.get(path, location.value)).toBeUndefined()

    // Remove array item
    let addresses = location.getField('addresses')
    addresses.add({ street: 'Washington' })
    addresses.remove(0)
    expect(toJS(addresses.value)).toEqual([{ street: 'Washington' }])
    expect(_.get('location.addresses', form.value)).toBe(addresses.value)
    expect(addresses.fields.length).toEqual(1)
    expect(_.get('0.street', addresses.value)).toBe('Washington')
  })

  describe('Field attributes', () => {
    let name = null

    beforeEach(() => {
      name = form.getField('location.addresses.0.tenants.0')
    })

    it('errors | isValid', () => {
      expect(name.isValid).toEqual(true)
      let isValid = jest.fn()
      let errors = jest.fn()
      dispose = _.over(
        reaction(
          () => name.isValid,
          x => isValid(x)
        ),
        reaction(
          () => name.errors,
          x => errors(x)
        )
      )
      name.validate()
      expect(errors).toHaveBeenCalledWith('Invalid tenant')
      expect(isValid).toHaveBeenCalledWith(false)
      form.reset()
      expect(errors).toHaveBeenCalledWith([])
      expect(isValid).toHaveBeenCalledWith(true)
    })

    it('isDirty', () => {
      expect(name.isDirty).toEqual(false)
      let handler = jest.fn()
      dispose = reaction(
        () => name.isDirty,
        x => handler(x)
      )
      name.value = 'New'
      expect(handler).toHaveBeenCalledWith(true)
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
      let state = form.getField('location.["country.state"]')
      state.add({ newField: { label: 'New name' } })
      expect(state.getField('newField')).not.toBeUndefined()
      state.reset()
      expect(state.isDirty).toEqual(false)
      expect(state.getField('newField')).toBeUndefined()

      // Resets array subfields
      let addresses = form.getField('location.addresses')
      addresses.add({ street: 'Laurence' })
      addresses.reset()
      expect(addresses.isDirty).toEqual(false)
      expect(addresses.fields.length).toBe(1)
      expect(addresses.getField('0.street').value).toBe('Meridian')
      expect(addresses.value).toEqual([
        { street: 'Meridian', tenants: ['John'] },
      ])
    })

    it('validate()', () => {
      expect(name.validate()).toEqual({
        'location.addresses.0.tenants.0': 'Invalid tenant',
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
      let state = form.getField('location.["country.state"]')
      state.add({ newField: { label: 'New name' } })
      expect(state.getField('newField')).not.toBeUndefined()
      state.clean()
      expect(state.isDirty).toEqual(false)
      expect(state.getField('newField')).not.toBeUndefined()

      // Cleans array subfields
      let addresses = form.getField('location.addresses')
      addresses.add({ street: 'Laurence' })
      addresses.clean()
      expect(addresses.isDirty).toEqual(false)
      expect(addresses.getField('1.street')).not.toBeUndefined()
      expect(addresses.value).toEqual([
        { street: 'Meridian', tenants: ['John'] },
        { street: 'Laurence' },
      ])
    })
  })

  describe('Form attributes', () => {
    it('getSnapshot()', () => {
      expect(form.getSnapshot()).toEqual({
        'location.country.state.zip': '07016',
        'location.addresses.0.street': 'Meridian',
        'location.addresses.0.tenants.0': 'John',
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
              tenants: ['John'],
            },
          ],
        },
      })
      form.getField('location.addresses').remove(0)
      expect(form.getNestedSnapshot()).toEqual({
        location: {
          'country.state': {
            zip: '07016',
          },
          addresses: [],
        },
      })
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

      let state = form.getField('location.["country.state"]')
      state.add({ capital: {} })
      expect(form.getPatch()).toEqual({})
      state.getField('capital').value = 'Tallahase'
      expect(form.getPatch()).toEqual({
        'location.country.state.capital': 'Tallahase',
      })
    })

    it('reset()', () => {
      let path = ['location', 'addresses']
      form.getField(path).add({ street: 'New' })
      form.reset()
      expect(form.getField(path).value.length).toBe(1)
      path = 'location.addresses.0.street'
      form.getField(path).value = 'New'
      form.reset()
      expect(form.getField(path).value).toBe('Meridian')
      expect(_.get(path, form.value)).toBe('Meridian')
    })

    it('isDirty', () => {
      expect(form.isDirty).toBe(false)
      let handler = jest.fn()
      dispose = reaction(
        () => form.isDirty,
        x => handler(x)
      )
      form.getField('location.addresses.0.street').value = 'New'
      expect(handler).toHaveBeenCalledWith(true)
      form.reset()
      expect(handler).toHaveBeenCalledWith(false)
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
        'location.addresses.0.tenants.0': 'Invalid tenant',
      })
      expect(form.isValid).toBe(false)
    })

    it('add()', () => {
      form.add({ newField: { label: 'New name' } })
      expect(form.getField('newField')).not.toBeUndefined()
    })
  })
})
