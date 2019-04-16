# Abstract

Middleware for express.js to add server timing headers

# Installation

    npm i -S server-timing-header

# Usage

```javascript
const serverTiming = require('server-timing-header');
const port = 3000;
const app = express();
app.use(serverTimingMiddleware);
app.get('/', function (req, res, next) {
  req.serverTiming.from('db');
  // fetching data from database
  req.serverTiming.to('db');
});
app.listen(port, () => console.log(`Example app listening on port ${port}!`));
```

# Documentation

<!-- Generated by documentation.js. Update this documentation by updating the source code. -->

### Table of Contents

-   [ServerTiming](#servertiming)
    -   [from](#from)
        -   [Parameters](#parameters)
        -   [Examples](#examples)
    -   [to](#to)
        -   [Parameters](#parameters-1)
        -   [Examples](#examples-1)
    -   [description](#description)
        -   [Parameters](#parameters-2)
    -   [duration](#duration)
        -   [Parameters](#parameters-3)
    -   [add](#add)
        -   [Parameters](#parameters-4)
        -   [Examples](#examples-2)
    -   [oldStyle](#oldstyle)
        -   [Parameters](#parameters-5)
    -   [newStyle](#newstyle)
        -   [Parameters](#parameters-6)
-   [index](#index)
    -   [Parameters](#parameters-7)
    -   [Examples](#examples-3)

## ServerTiming

-   **See: <https://w3c.github.io/server-timing/>**

Middleware for express.js to add Server Timing headers

**Meta**

-   **author**: Anton Nemtsev &lt;thesilentimp@gmail.com>

### from

Set start time for metric

#### Parameters

-   `name` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** — metric name
-   `description` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)?** — description of the metric

#### Examples

You may define only start time for metric


```javascript
const serverTiming = require('server-timing-header');
const port = 3000;
const app = express();
app.use(serverTimingMiddleware);
app.get('/', function (req, res, next) {
  // If you define only start time for metric,
  // then as the end time will be used header sent time
  req.serverTiming.from('metric', 'metric description');
  // fetching data from database
});
app.listen(port, () => console.log(`Example app listening on port ${port}!`));
```

### to

Set end time for metric

#### Parameters

-   `name` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** — metric name
-   `description` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)?** — description of the metric

#### Examples

You may define only end time for metric


```javascript
const serverTiming = require('server-timing-header');
const port = 3000;
const app = express();
app.use(serverTimingMiddleware);
app.get('/', function (req, res, next) {
  // fetching data from database
  // If you define only end time for metric,
  // then as the start time will be used middleware initialization time
  req.serverTiming.to('metric');
});
app.listen(port, () => console.log(`Example app listening on port ${port}!`));
```

### description

Add description to specific metric

#### Parameters

-   `name` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** — metric name
-   `description` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** — description of the metric

### duration

Add duration to specific metric

#### Parameters

-   `name` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** — metric name
-   `duration` **float** — duration of the metric

### add

Add metric

#### Parameters

-   `name` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** metric name
-   `description` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** — metric description
-   `duration` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** — metric duration (optional, default `0.0`)

#### Examples

Add metric


```javascript
const serverTiming = require('server-timing-header');
const port = 3000;
const app = express();
app.use(serverTimingMiddleware);
app.get('/', function (req, res, next) {
  // You got time metric from the external source
  req.serverTiming.add('metric', 'metric description', 52.3);
});
app.listen(port, () => console.log(`Example app listening on port ${port}!`));
```

### oldStyle

Build server-timing header value by old specification

#### Parameters

-   `name` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** metric name
-   `description` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** metric description
-   `duration` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** metric duration

### newStyle

Build server-timing header value by current specification

#### Parameters

-   `name` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** metric name
-   `description` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** metric description
-   `duration` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** metric duration

## index

Express middleware add serverTiming to request and
make sure that we will send this headers before express finish request

### Parameters

-   `request`  
-   `response`  
-   `next`  

### Examples

How to add middleware


```javascript
const serverTiming = require('server-timing-header');
const port = 3000;
const app = express();
app.use(serverTimingMiddleware);
app.get('/', function (req, res, next) {
  req.serverTiming.from('db');
  // fetching data from database
  req.serverTiming.to('db');
});
app.listen(port, () => console.log(`Example app listening on port ${port}!`));
```
