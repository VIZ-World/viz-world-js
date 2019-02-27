# viz.js
viz.js the JavaScript Library with API Support for VIZ blockchain

[![npm version](https://badge.fury.io/js/viz-js-lib.svg)](https://badge.fury.io/js/viz-js-lib)

# Documentation

Here is full documentation:
https://github.com/VIZ-Blockchain/viz-js-lib/tree/master/doc

# Install
```
$ npm install viz-js-lib --save
```

## Browser
```html
<script src="./viz.min.js"></script>
<script>
viz.api.getAccounts(['ned', 'dan'], function(err, response){
    console.log(err, response);
});
</script>
```

## Server

## WebSockets and HTTP transport
Library support 2 transport types: ws, wss for websocket and http, https for pure HTTP JSONRPC.
Examples:
```js
viz.config.set('websocket','wss://viz.lexai.host/');
viz.config.set('websocket','https://rpc.viz.ropox.app/');
```

## Examples
### Broadcast Vote
```js
var viz = require('viz-js-lib');//nodejs lib

var wif = viz.auth.toWif(username, password, 'posting');
viz.broadcast.vote(wif, voter, author, permlink, weight, function(err, result) {
	console.log(err, result);
});
```

### Get Accounts
```js
viz.api.getAccounts(['ned', 'dan'], function(err, result) {
	console.log(err, result);
});
```

## Contributions
Patches are welcome! Contributors are listed in the package.json file. Please run the tests before opening a pull request and make sure that you are passing all of them. If you would like to contribute, but don't know what to work on, check the issues list.

## Issues
When you find issues, please report them!

## License
MIT
