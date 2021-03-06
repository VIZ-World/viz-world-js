import Promise from 'bluebird';
import newDebug from 'debug';
import noop from 'lodash/noop';

import broadcastHelpers from './helpers';
import formatterFactory from '../formatter';
import operations from './operations';
import nodeApi from '../api';
import nodeAuth from '../auth';
import { camelCase } from '../utils';
import config from '../config'

const debug = newDebug('viz:broadcast');
const formatter = formatterFactory(nodeApi);

const Broadcaster = {};

// Base transaction logic -----------------------------------------------------

/**
 * Sign and broadcast transactions on the network
 */

Broadcaster.send = function Broadcaster$send(tx, privKeys, callback) {
  const resultP = Broadcaster._prepareTransaction(tx)
    .then((transaction) => {
      debug(
        'Signing transaction (transaction, transaction.operations)',
        transaction, transaction.operations
      );
      return Promise.join(
        transaction,
        nodeAuth.signTransaction(transaction, privKeys)
      );
    })
    .spread((transaction, signedTransaction) => {
      debug(
        'Broadcasting transaction (transaction, transaction.operations)',
        transaction, transaction.operations
      );
      return config.get('broadcast_transaction_with_callback')
        ? nodeApi.broadcastTransactionWithCallbackAsync(() => {}, signedTransaction).then(() => signedTransaction)
        : nodeApi.broadcastTransactionAsync(signedTransaction).then(() => signedTransaction)
    });

  resultP.nodeify(callback || noop);
};

Broadcaster._prepareTransaction = function Broadcaster$_prepareTransaction(tx) {
  const propertiesP = nodeApi.getDynamicGlobalPropertiesAsync()
  return propertiesP
    .then((properties) => {
      // Set defaults on the transaction
      const chainDate = new Date(properties.time + 'Z');
      const refBlockNum = (properties.head_block_number - 3) & 0xFFFF;
      return nodeApi.getBlockAsync(properties.head_block_number - 2).then((block) => {
        const headBlockId = block.previous;
        return Object.assign({
          ref_block_num: refBlockNum,
          ref_block_prefix: new Buffer(headBlockId, 'hex').readUInt32LE(4),
          expiration: new Date(
            chainDate.getTime() +
            60 * 1000
          ),
        }, tx);
      });
    });
};

// Generated wrapper ----------------------------------------------------------

// Generate operations from operations.js
operations.forEach((operation) => {
  const operationName = camelCase(operation.operation);
  const operationParams = operation.params || [];

  const useCommentPermlink =
    operationParams.indexOf('parent_permlink') !== -1 &&
    operationParams.indexOf('parent_permlink') !== -1;

  Broadcaster[`${operationName}With`] =
    function Broadcaster$specializedSendWith(wif, options, callback) {
      debug(`Sending operation "${operationName}" with`, {options, callback});
      const keys = {};
      if (operation.roles && operation.roles.length) {
        keys[operation.roles[0]] = wif; // TODO - Automatically pick a role? Send all?
      }
      return Broadcaster.send({
        extensions: [],
        operations: [[operation.operation, Object.assign(
          {},
          options,
          options.json_metadata != null ? {
            json_metadata: toString(options.json_metadata),
          } : {},
          useCommentPermlink && options.permlink == null ? {
            permlink: formatter.contentPermlink(options.parent_author, options.parent_permlink),
          } : {}
        )]],
      }, keys, callback);
    };

  Broadcaster[operationName] =
    function Broadcaster$specializedSend(wif, ...args) {
      debug(`Parsing operation "${operationName}" with`, {args});
      const options = operationParams.reduce((memo, param, i) => {
        memo[param] = args[i]; // eslint-disable-line no-param-reassign
        return memo;
      }, {});
      const callback = args[operationParams.length];
      return Broadcaster[`${operationName}With`](wif, options, callback);
    };
});

const toString = obj => typeof obj === 'object' ? JSON.stringify(obj) : obj;
broadcastHelpers(Broadcaster);

Promise.promisifyAll(Broadcaster);

exports = module.exports = Broadcaster;
