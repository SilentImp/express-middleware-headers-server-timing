const { Request } = require('jest-express/lib/request')
const { Response } = require('jest-express/lib/response')

const middleware = require('./index.js')

const modernChrome = () =>
  'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3809.100 Safari/537.36'
const oldChrome = () =>
  'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3809.100 Safari/537.36'

describe('server Timing middleware should', () => {
  it('add serverTiming object to request object', () => {
    expect.assertions(1)
    const next = jest.fn()
    const request = new Request()
    request.header = modernChrome
    const response = new Response()

    middleware()(request, response, next)

    expect(request).toHaveProperty('serverTiming')
  })

  it('pass request to next middleware', () => {
    expect.assertions(1)
    const next = jest.fn()
    const request = new Request()
    request.header = modernChrome
    const response = new Response()

    middleware()(request, response, next)
    expect(next).toHaveBeenCalledWith()
  })

  it('allow measure time between two points', () => {
    expect.assertions(3)
    const next = jest.fn()
    const request = new Request()
    request.header = modernChrome
    const response = new Response()

    middleware({ sendHeaders: false })(request, response, next)

    request.serverTiming.from(
      'userData',
      'getting user data from user microservice'
    )
    request.serverTiming.to('userData')
    request.serverTiming.addHeaders(response)

    expect(response.headers).toHaveProperty('server-timing')
    expect(response.headers['server-timing']).toHaveLength(1)
    expect(response.headers['server-timing'][0]).toStrictEqual(
      expect.stringContaining(
        'userData;desc="getting user data from user microservice";dur='
      )
    )
  })

  it('allow measure time between two points more than once', () => {
    expect.assertions(4)
    const next = jest.fn()
    const request = new Request()
    request.header = modernChrome
    const response = new Response()

    middleware({ sendHeaders: false })(request, response, next)

    request.serverTiming.from(
      'userData',
      'getting user data from user microservice'
    )
    request.serverTiming.to('userData')
    request.serverTiming.from(
      'itemData',
      'getting item data from item microservice'
    )
    request.serverTiming.to('userData')
    request.serverTiming.addHeaders(response)

    expect(response.headers).toHaveProperty('server-timing')
    expect(response.headers['server-timing']).toHaveLength(2)
    expect(response.headers['server-timing'][0]).toStrictEqual(
      expect.stringContaining(
        'userData;desc="getting user data from user microservice";dur='
      )
    )
    expect(response.headers['server-timing'][1]).toStrictEqual(
      expect.stringContaining(
        'itemData;desc="getting item data from item microservice";dur='
      )
    )
  })

  it('allow add server timing with exact duration', () => {
    expect.assertions(3)
    const next = jest.fn()
    const request = new Request()
    request.header = modernChrome
    const response = new Response()

    middleware({ sendHeaders: false })(request, response, next)

    request.serverTiming.add(
      'userData',
      'getting user data from user microservice',
      123
    )
    request.serverTiming.addHeaders(response)

    expect(response.headers).toHaveProperty('server-timing')
    expect(response.headers['server-timing']).toHaveLength(1)
    expect(response.headers['server-timing']).toContainEqual(
      'userData;desc="getting user data from user microservice";dur=123'
    )
  })

  it('allow add server timing with exact duration more then once', () => {
    expect.assertions(4)
    const next = jest.fn()
    const request = new Request()
    request.header = modernChrome
    const response = new Response()

    middleware({ sendHeaders: false })(request, response, next)

    request.serverTiming.add(
      'userData',
      'getting user data from user microservice',
      123
    )
    request.serverTiming.add(
      'itemData',
      'getting item data from item microservice',
      234
    )
    request.serverTiming.addHeaders(response)

    expect(response.headers).toHaveProperty('server-timing')
    expect(response.headers['server-timing']).toHaveLength(2)
    expect(response.headers['server-timing']).toContainEqual(
      'userData;desc="getting user data from user microservice";dur=123'
    )
    expect(response.headers['server-timing']).toContainEqual(
      'itemData;desc="getting item data from item microservice";dur=234'
    )
  })

  it('allow to overwrite server timing duration', () => {
    expect.assertions(3)
    const next = jest.fn()
    const request = new Request()
    request.header = modernChrome
    const response = new Response()

    middleware({ sendHeaders: false })(request, response, next)

    request.serverTiming.add(
      'userData',
      'getting user data from user microservice',
      123
    )
    request.serverTiming.duration('userData', 234)
    request.serverTiming.addHeaders(response)

    expect(response.headers).toHaveProperty('server-timing')
    expect(response.headers['server-timing']).toHaveLength(1)
    expect(response.headers['server-timing']).toContainEqual(
      'userData;desc="getting user data from user microservice";dur=234'
    )
  })

  it('allow to overwrite server timing description', () => {
    expect.assertions(3)
    const next = jest.fn()
    const request = new Request()
    request.header = modernChrome
    const response = new Response()

    middleware({ sendHeaders: false })(request, response, next)

    request.serverTiming.add('userData', 'bla bla bla', 123)

    request.serverTiming.description(
      'userData',
      'getting user data from user microservice'
    )

    request.serverTiming.addHeaders(response)

    expect(response.headers).toHaveProperty('server-timing')
    expect(response.headers['server-timing']).toHaveLength(1)
    expect(response.headers['server-timing']).toContainEqual(
      'userData;desc="getting user data from user microservice";dur=123'
    )
  })

  it('should use old standards for Chrome v60-64', () => {
    expect.assertions(3)
    const next = jest.fn()
    const request = new Request()
    request.header = oldChrome
    const response = new Response()

    middleware({ sendHeaders: false })(request, response, next)

    request.serverTiming.add(
      'userData',
      'getting user data from user microservice',
      123
    )
    request.serverTiming.duration('userData', 234)
    request.serverTiming.addHeaders(response)

    expect(response.headers).toHaveProperty('server-timing')
    expect(response.headers['server-timing']).toHaveLength(1)
    expect(response.headers['server-timing']).toContainEqual(
      'userData=234; "getting user data from user microservice"'
    )
  })

  it('allow add hook to modify the data before add headers', () => {
    expect.assertions(2)
    const next = jest.fn()
    const request = new Request()
    request.header = modernChrome
    const response = new Response()

    middleware({ sendHeaders: false })(request, response, next)

    request.serverTiming.addHook('substractDataTimeFromRenderTime', metrics => {
      const updated = { ...metrics }
      if (updated.data && updated.render) {
        const renderDuration = request.serverTiming.calculateDurationSmart(
          updated.render
        )
        const dataDuration = request.serverTiming.calculateDurationSmart(
          updated.data
        )
        updated.render.duration = Math.abs(renderDuration - dataDuration)
      }
      return updated
    })

    request.serverTiming.add('render', 'rendering app', 600)
    request.serverTiming.add('data', 'getting data from microservices', 550)

    request.serverTiming.addHeaders(response)

    expect(response.headers).toHaveProperty('server-timing')
    expect(response.headers['server-timing']).toContainEqual(
      'render;desc="rendering app";dur=50'
    )
  })

  it('allow remove hook', () => {
    expect.assertions(2)
    const next = jest.fn()
    const request = new Request()
    request.header = modernChrome
    const response = new Response()

    middleware({ sendHeaders: false })(request, response, next)

    request.serverTiming.addHook('substractDataTimeFromRenderTime', metrics => {
      const updated = { ...metrics }
      if (updated.data && updated.render) {
        const renderDuration = request.serverTiming.calculateDurationSmart(
          updated.render
        )
        const dataDuration = request.serverTiming.calculateDurationSmart(
          updated.data
        )
        updated.render.duration = Math.abs(renderDuration - dataDuration)
      }
      return updated
    })

    request.serverTiming.add('render', 'rendering app', 600)
    request.serverTiming.add('data', 'getting data from microservices', 550)

    request.serverTiming.removeHook('substractDataTimeFromRenderTime')

    request.serverTiming.addHeaders(response)

    expect(response.headers).toHaveProperty('server-timing')
    expect(response.headers['server-timing']).toContainEqual(
      'render;desc="rendering app";dur=600'
    )
  })
})
