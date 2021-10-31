const onHeaders = require('on-headers')

const HEADER_NAME = 'server-timing'
const INVALID_NAME = 'Name contain forbidden symbols'
const HEADERS_SENT = 'Headers was already sent and we can not add new headers'

/**
 * Middleware for express.js to add Server Timing headers
 *
 * @namespace ServerTiming
 * @class ServerTiming
 * @see https://w3c.github.io/server-timing/
 * @author Anton Nemtsev <thesilentimp@gmail.com>
 *
 */
class ServerTiming {
  /**
   * Create server timing controller
   * @constructor
   * @param {string} [userAgent] — string that contain user agent description
   * @param {boolean} [sendHeaders=true] - you may send or don't send headers depending on environment
   */
  constructor (userAgent = '', sendHeaders = true) {
    // Before 64 version Chrome support old server-timing
    // specification with different syntax
    const isChrome = userAgent.indexOf(' Chrome/') > -1
    const chromeData = / Chrome\/([\d]+)./gi.exec(userAgent)
    const chromeVersion =
      chromeData === null ? null : parseInt(chromeData[1], 10)
    const isCanary = isChrome && chromeVersion > 64
    this.oldSpecification = isChrome && !isCanary

    /**
     * If start time is not specified for metric
     * we will use time of middleware initialization
     * @private
     * @type {integer[]} - time of middleware initialization [seconds, nanoseconds]
     */
    this.initialized = process.hrtime()

    /**
     * Should middleware send headers
     * @private
     * @type {boolean} - if false middleware will not add headers
     */
    this.sendHeaders = sendHeaders

    /**
     * @private
     * @type {object} - We will store time metrics in this object
     */
    this.metrics = {}

    /**
     * @private
     * @type {array} - Array of callbacks
     */
    this.hooks = []

    // We should keep consistent context for non static methods
    Object.getOwnPropertyNames(Object.getPrototypeOf(this)).forEach(name => {
      const method = this[name]
      if (name !== 'constructor' && typeof method === 'function') {
        this[name] = method.bind(this)
      }
    })
  }

  /**
   * Add callback to modify data before create and send headers
   * @public
   * @param {string} name — hook name
   * @param {function} callback — function that may modify data before send headers
   * @param {number} callbackIndex - index that will be used to sort callbacks before execution
   * @example <caption>Add hook to mutate the metrics</caption>
   * const express = require('express');
   * const serverTimingMiddleware = require('server-timing-header');
   * const port = 3000;
   * const app = express();
   * app.use(serverTimingMiddleware());
   * app.use(function (req, res, next) {
   *   // If one measurement include other inside you may substract times
   *   req.serverTiming.addHook('substractDataTimeFromRenderTime', function (metrics) {
   *      const updated = { ...metrics };
   *      if (updated.data && updated.render) {
   *        const renderDuration  = req.serverTiming.calculateDurationSmart(updated.render);
   *        const dataDuration  = req.serverTiming.calculateDurationSmart(updated.data);
   *        updated.render.duration = Math.abs(renderDuration - dataDuration);
   *      }
   *      return updated;
   *   });
   * });
   * app.listen(port, () => console.log(`Example app listening on port ${port}!`));
   */
  addHook (name, callback, callbackIndex) {
    let index = callbackIndex
    if (index === undefined) {
      index = this.hooks.length + 1
    }
    this.hooks.push({
      name,
      callback,
      index
    })
  }

  /**
   * Remove callback with specific name
   * @public
   * @param {string} name — hook name
   */
  removeHook (name) {
    this.hooks = this.hooks.filter(
      ({ name: callbackName }) => callbackName !== name
    )
  }

  /**
   * Set start time for metric
   * @public
   * @param {string} name — metric name
   * @param {string} [description] — description of the metric
   * @throw {Error} — throw an error if name is not valid
   * @example <caption>You may define only start time for metric</caption>
   * const express = require('express');
   * const serverTimingMiddleware = require('server-timing-header');
   * const port = 3000;
   * const app = express();
   * app.use(serverTimingMiddleware());
   * app.get('/', function (req, res, next) {
   *   // If you define only start time for metric,
   *   // then as the end time will be used header sent time
   *   req.serverTiming.from('metric', 'metric description');
   *   // fetching data from database
   * });
   * app.listen(port, () => console.log(`Example app listening on port ${port}!`));
   */
  from (name, description) {
    this.set(name, 'from', process.hrtime())
    if (description) this.description(name, description)
  }

  /**
   * Set end time for metric
   * @public
   * @param {string} name — metric name
   * @param {string} [description] — description of the metric
   * @throw {Error} — throw an error if name is not valid
   * @example <caption>You may define only end time for metric</caption>
   * const express = require('express');
   * const serverTimingMiddleware = require('server-timing-header');
   * const port = 3000;
   * const app = express();
   * app.use(serverTimingMiddleware());
   * app.get('/', function (req, res, next) {
   *   // fetching data from database
   *   // If you define only end time for metric,
   *   // then as the start time will be used middleware initialization time
   *   req.serverTiming.to('metric');
   * });
   * app.listen(port, () => console.log(`Example app listening on port ${port}!`));
   */
  to (name, description) {
    this.set(name, 'to', process.hrtime())
    if (description) this.description(name, description)
  }

  /**
   * Add description to specific metric
   * @public
   * @param {string} name — metric name
   * @param {string} description — description of the metric
   * @throw {Error} — throw an error if name is not valid
   */
  description (name, description) {
    this.set(name, 'description', description)
  }

  /**
   * Add duration to specific metric
   * @public
   * @param {string} name — metric name
   * @param {float} duration — duration of the metric
   * @throw {Error} — throw an error if name is not valid
   */
  duration (name, duration) {
    this.set(name, 'duration', duration)
  }

  /**
   * Add property for metric
   * or create new metric with this property
   * if metric with this name not found
   * @private
   * @param {string} name - metric name
   * @param {string} field - property name
   * @param {mixed} value — property value
   * @throw {Error} — throw an error if name contains invalid characters
   */
  set (name, field, value) {
    if (!ServerTiming.nameIsValid(name)) throw new Error(INVALID_NAME)
    if (typeof this.metrics[name] === 'undefined') {
      this.metrics[name] = { [[field]]: value }
    } else {
      this.metrics[name][field] = value
    }
  }

  /**
   * Add metric
   * @param {string} name - metric name
   * @param {string} description — metric description
   * @param {number} duration — metric duration
   * @throw {Error} — throw an error if name contains invalid characters
   * @example <caption>Add metric</caption>
   * const express = require('express');
   * const serverTimingMiddleware = require('server-timing-header');
   * const port = 3000;
   * const app = express();
   * app.use(serverTimingMiddleware());
   * app.get('/', function (req, res, next) {
   *   // You got time metric from the external source
   *   req.serverTiming.add('metric', 'metric description', 52.3);
   * });
   * app.listen(port, () => console.log(`Example app listening on port ${port}!`));
   */
  add (name, description, duration = 0.0) {
    if (!ServerTiming.nameIsValid(name)) throw new Error(INVALID_NAME)
    this.metrics[name] = {
      description,
      duration
    }
  }

  /**
   * Send current set of server timing headers
   * @private
   * @param {object} response — express.js response object
   * @see https://expressjs.com/en/4x/api.html#res
   * @example <caption>How to add middleware</caption>
   * const express = require('express');
   * const serverTimingMiddleware = require('server-timing-header');
   * const port = 3000;
   * const app = express();
   * app.use(serverTimingMiddleware());
   * app.get('/', function (req, res, next) {
   *   req.serverTiming.from('db');
   *   // fetching data from database
   *   req.serverTiming.to('db');
   * });
   * app.listen(port, () => console.log(`Example app listening on port ${port}!`));
   */
  addHeaders (response) {
    if (!this.addHeaders) return
    if (response.headerSent) throw new Error(HEADERS_SENT)
    const updatedMetrics = this.hooks
      .sort(({ index: indexA }, { index: indexB }) => indexA - indexB)
      .map(({ callback }) => callback)
      .reduce((metrics, callback) => {
        return callback(metrics)
      }, this.metrics)
    let metrics = Object.entries(updatedMetrics).reduce(
      (collector, element) => {
        const [name, { from, to, description, duration }] = element
        collector.push(
          ServerTiming.buildHeader(
            {
              name,
              description,
              from: from || this.initialized,
              to: to || process.hrtime(),
              duration
            },
            this.oldSpecification
          )
        )
        return collector
      },
      []
    )

    if (
      Array.isArray(response.headers['server-timing']) &&
      response.headers['server-timing'].length > 0
    ) {
      metrics = [
        ...response.headers['server-timing'],
        ...metrics
      ]
    }

    if (metrics.length > 0) response.set(HEADER_NAME, metrics)
    this.metrics = {}
  }

  /**
   * Build server-timing header value by old specification
   * @param {string} name - metric name
   * @param {string} description - metric description
   * @param {string} duration - metric duration
   * @return {string} — server-timing header value
   */
  static oldStyle (name, description, duration) {
    return `${name}${typeof duration !== 'undefined' ? `=${duration}` : ''}${
      typeof description !== 'undefined' ? `; "${description}"` : ''
    }`
  }

  /**
   * Build server-timing header value by current specification
   * @param {string} name - metric name
   * @param {string} description - metric description
   * @param {string} duration - metric duration
   * @return {string} — server-timing header value
   */
  static newStyle (name, description, duration) {
    return `${name}${
      typeof description !== 'undefined' ? `;desc="${description}"` : ''
    }${typeof duration !== 'undefined' ? `;dur=${duration}` : ''}`
  }

  /**
   * Build server timing headers
   * @static
   * @private
   * @param {object} metric — object that contain metric information
   * @param {string} metric.name — metric name
   * @param {string} metric.description — metric description
   * @param {integer[]} metric.from — start time [seconds, nanoseconds]
   * @param {integer[]} metric.to — end time [seconds, nanoseconds]
   * @return {string} — header value with timings for specific metric
   */
  static buildHeader (
    { name, description, duration, from, to },
    oldSpecification = false
  ) {
    const time = duration || ServerTiming.calculateDuration(from, to)
    return oldSpecification
      ? ServerTiming.oldStyle(name, description, time)
      : ServerTiming.newStyle(name, description, time)
  }

  /**
   * Calculate duration between two timestamps, if from or two is undefined — will use initialization time and current time to replace
   * @public
   * @param {object} metric — object that contain metric information
   * @param {string} metric.name — metric name
   * @param {string} metric.description — metric description
   * @param {integer[]} metric.from — start time [seconds, nanoseconds], if undefined, initialization time will be used
   * @param {integer[]} metric.to — end time [seconds, nanoseconds], if undefined, current timestamp will be used
   * @param {integer} metric.duration — time in milliseconds, if not undefined method will just return durations
   * @return {integer} - duration in milliseconds
   */
  calculateDurationSmart (metric) {
    const fromLabel = metric.from || this.initialized
    const toLabel = metric.to || process.hrtime()
    return (
      metric.duration || ServerTiming.calculateDuration(fromLabel, toLabel)
    )
  }

  /**
   * Calculate duration between two timestamps
   * @static
   * @private
   * @param {integer[]} from — start time [seconds, nanoseconds]
   * @param {integer[]} to — end time [seconds, nanoseconds]
   * @return {integer} - duration in milliseconds
   */
  static calculateDuration (from, to) {
    const fromTime = parseInt(from[0] * 1e3 + from[1] * 1e-6, 10)
    const toTime = parseInt(to[0] * 1e3 + to[1] * 1e-6, 10)
    return Math.abs(toTime - fromTime)
  }

  /**
   * Check if metric name is valid
   * (),/:;<=>?@[\]{}" Don't allowed
   * Minimal length is one symbol
   * Digits, alphabet characters,
   * and !#$%&'*+-.^_`|~ are allowed
   *
   * @static
   * @private
   * @see https://www.w3.org/TR/2019/WD-server-timing-20190307/#the-server-timing-header-field
   * @see https://tools.ietf.org/html/rfc7230#section-3.2.6
   * @param {string} name — metric name
   * @return {boolean} — is name valid
   */
  static nameIsValid (name) {
    return /^[!#$%&'*+\-.^_`|~0-9a-z]+$/gi.test(name)
  }
}

/**
 * Express middleware add serverTiming to request and
 * make sure that we will send this headers before express finish request
 * @exports serverTimingMiddleware
 * @param {object} [options] — middleware options
 * @param {boolean} [options.sendHeaders] - should middleware send headers (may be disabled for some environments)
 * @return {function} - return express middleware
 * @example <caption>How to add middleware</caption>
 * const express = require('express');
 * const serverTimingMiddleware = require('server-timing-header');
 * const port = 3000;
 * const app = express();
 * app.use(serverTimingMiddleware());
 * app.get('/', function (req, res, next) {
 *   req.serverTiming.from('db');
 *   // fetching data from database
 *   req.serverTiming.to('db');
 * });
 * app.listen(port, () => console.log(`Example app listening on port ${port}!`));
 */
module.exports = ({ sendHeaders = true } = {}) => {
  function serverTimingMiddleware (request, response, next) {
    // Adding controller to request object
    request.serverTiming = new ServerTiming(
      request.header('user-agent'),
      sendHeaders
    )

    // We should send server-timing headers before headers are sent
    if (sendHeaders) {
      onHeaders(response, () => {
        request.serverTiming.addHeaders(response)
      })
    }

    next()
  }

  return serverTimingMiddleware
}
