const onHeaders = require("on-headers");

const HEADER_NAME = "server-timing";
const INVALID_NAME = "Name contain forbidden symbols";
const HEADERS_SENT = "Headers was already sent and we can not add new headers";

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
   */
  constructor(userAgent = "") {
    // Before 64 version Chrome support old server-timing
    // specification with different syntax
    const isChrome = userAgent.indexOf(" Chrome/") > -1;
    const chromeData = / Chrome\/([\d]+)./gi.exec(userAgent);
    const chromeVersion =
      chromeData === null ? null : parseInt(chromeData[1], 10);
    const isCanary = isChrome && chromeVersion > 64;
    this.oldSpecification = isChrome && !isCanary;

    /**
     * If start time is not specified for metric
     * we will use time of middleware initialization
     * @private
     * @type {integer[]} - time of middleware initialization [seconds, nanoseconds]
     */
    this.initialized = process.hrtime();

    /**
     * @private
     * @type {object} - We will store time metrics in this object
     */
    this.metrics = {};

    // We should keep consistent context for non static methods
    this.addHeaders = this.addHeaders.bind(this);
    this.from = this.from.bind(this);
    this.to = this.to.bind(this);
  }

  /**
   * Set start time for metric
   * @public
   * @param {string} name — metric name
   * @param {string} [description] — description of the metric
   * @throw {Error} — throw an error if name is not valid
   * @example <caption>You may define only start time for metric</caption>
   * const serverTiming = require('server-timing-header');
   * const port = 3000;
   * const app = express();
   * app.use(serverTimingMiddleware);
   * app.get('/', function (req, res, next) {
   *   // If you define only start time for metric,
   *   // then as the end time will be used header sent time
   *   req.serverTiming.from('metric', 'metric description');
   *   // fetching data from database
   * });
   * app.listen(port, () => console.log(`Example app listening on port ${port}!`));
   */
  from(name, description) {
    this.set(name, "from", process.hrtime());
    if (description) this.description.call(this, name, description);
  }

  /**
   * Set end time for metric
   * @public
   * @param {string} name — metric name
   * @param {string} [description] — description of the metric
   * @throw {Error} — throw an error if name is not valid
   * @example <caption>You may define only end time for metric</caption>
   * const serverTiming = require('server-timing-header');
   * const port = 3000;
   * const app = express();
   * app.use(serverTimingMiddleware);
   * app.get('/', function (req, res, next) {
   *   // fetching data from database
   *   // If you define only end time for metric,
   *   // then as the start time will be used middleware initialization time
   *   req.serverTiming.to('metric');
   * });
   * app.listen(port, () => console.log(`Example app listening on port ${port}!`));
   */
  to(name, description) {
    this.set(name, "to", process.hrtime());
    if (description) this.description.call(this, name, description);
  }

  /**
   * Add description to specific metric
   * @public
   * @param {string} name — metric name
   * @param {string} description — description of the metric
   * @throw {Error} — throw an error if name is not valid
   */
  description(name, description) {
    this.set(name, "description", description);
  }

  /**
   * Add duration to specific metric
   * @public
   * @param {string} name — metric name
   * @param {float} duration — duration of the metric
   * @throw {Error} — throw an error if name is not valid
   */
  duration(name, duration) {
    this.set(name, "duration", duration);
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
  set(name, field, value) {
    if (!ServerTiming.nameIsValid(name)) throw new Error(INVALID_NAME);
    if (typeof this.metrics[name] === "undefined") {
      this.metrics[name] = { [[field]]: value };
    } else {
      this.metrics[name][field] = value;
    }
  }

  /**
   * Add metric
   * @param {object} response — express.js response object
   * @param {string} name - metric name
   * @param {string} description — metric description
   * @param {number} duration — metric duration
   * @throw {Error} — throw an error if name contains invalid characters
   * @example <caption>Add metric</caption>
   * const serverTiming = require('server-timing-header');
   * const port = 3000;
   * const app = express();
   * app.use(serverTimingMiddleware);
   * app.get('/', function (req, res, next) {
   *   // You got time metric from the external source
   *   req.serverTiming.add(res, 'metric', 'metric description', 52.3);
   * });
   * app.listen(port, () => console.log(`Example app listening on port ${port}!`));
   */
  add(response, name, description, duration = 0.0) {
    if (!ServerTiming.nameIsValid(name)) throw new Error(INVALID_NAME);
    this.metrics[name] = {
      description,
      duration
    };
  }

  /**
   * Send current set of server timing headers
   * @private
   * @param {object} response — express.js response object
   * @see https://expressjs.com/en/4x/api.html#res
   * @example <caption>How to add middleware</caption>
   * const serverTiming = require('server-timing-header');
   * const port = 3000;
   * const app = express();
   * app.use(serverTimingMiddleware);
   * app.get('/', function (req, res, next) {
   *   req.serverTiming.from('db');
   *   // fetching data from database
   *   req.serverTiming.to('db');
   * });
   * app.listen(port, () => console.log(`Example app listening on port ${port}!`));
   */
  addHeaders(response) {
    if (response.headerSent) throw new Error(HEADERS_SENT);
    const now = process.hrtime();
    const metrics = Object.entries(this.metrics).reduce(
      (collector, element) => {
        const [name, { from, to, description, duration }] = element;
        collector.push(
          ServerTiming.buildHeader(
            {
              name,
              description,
              from: from || this.initialized,
              to: to || now,
              duration
            },
            this.oldSpecification
          )
        );
        return collector;
      },
      []
    );
    if (metrics.length > 0) response.set(HEADER_NAME, metrics);
    this.metrics = {};
  }

  /**
   * Build server-timing header value by old specification
   * @param {string} name - metric name
   * @param {string} description - metric description
   * @param {string} duration - metric duration
   * @retur {string} — server-timing header value
   */
  static oldStyle(name, description, duration) {
    return `${name}${typeof duration !== "undefined" ? `=${duration}` : ""}${
      typeof description !== "undefined" ? `; "${description}"` : ""
    }`;
  }

  /**
   * Build server-timing header value by current specification
   * @param {string} name - metric name
   * @param {string} description - metric description
   * @param {string} duration - metric duration
   * @retur {string} — server-timing header value
   */
  static newStyle(name, description, duration) {
    return `${name}${
      typeof description !== "undefined" ? `;desc="${description}"` : ""
    }${typeof duration !== "undefined" ? `;dur=${duration}` : ""}`;
  }

  /**
   * Build server timing headers
   * @private
   * @static
   * @param {object} metric — object that contain metric information
   * @param {string} metric.name — metric name
   * @param {string} metric.description — metric description
   * @param {integer[]} metric.from — start time [seconds, nanoseconds]
   * @param {integer[]} metric.to — end time [seconds, nanoseconds]
   * @return {string} — header value with timings for specific metric
   */
  static buildHeader(
    { name, description, from, to, duration },
    oldSpecification = false
  ) {
    const fromTime = parseInt(from[0] * 1e3 + from[1] * 1e-6, 10);
    const toTime = parseInt(to[0] * 1e3 + to[1] * 1e-6, 10);
    const time = duration || toTime - fromTime;
    return oldSpecification
      ? ServerTiming.oldStyle(name, description, time)
      : ServerTiming.newStyle(name, description, time);
  }

  /**
   * Check if metric name is valid
   * (),/:;<=>?@[\]{}" Don't allowed
   * Minimal length is one symbol
   * Digits, alphabet characters,
   * and !#$%&'*+-.^_`|~ are allowed
   *
   * @private
   * @static
   * @see https://www.w3.org/TR/2019/WD-server-timing-20190307/#the-server-timing-header-field
   * @see https://tools.ietf.org/html/rfc7230#section-3.2.6
   * @param {string} name — metric name
   * @return {boolean} — is name valid
   */
  static nameIsValid(name) {
    return /^[!#$%&'*+\-.^_`|~0-9a-z]+$/gi.test(name);
  }
}

/**
 * Express middleware add serverTiming to request and
 * make sure that we will send this headers before express finish request
 * @exports serverTimingMiddleware
 * @example <caption>How to add middleware</caption>
 * const serverTiming = require('server-timing-header');
 * const port = 3000;
 * const app = express();
 * app.use(serverTimingMiddleware);
 * app.get('/', function (req, res, next) {
 *   req.serverTiming.from('db');
 *   // fetching data from database
 *   req.serverTiming.to('db');
 * });
 * app.listen(port, () => console.log(`Example app listening on port ${port}!`));
 */
module.exports = function serverTimingMiddleware(request, response, next) {
  // Adding controller to request object
  request.serverTiming = new ServerTiming(request.header("user-agent"));

  // We should send server-timing headers before headers are sent
  onHeaders(response, () => {
    request.serverTiming.addHeaders(response);
  });

  next();
};
