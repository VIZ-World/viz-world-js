require('babel-polyfill');
import Promise from 'bluebird';
import assert from 'assert';
import makeStub from 'mocha-make-stub'
import should from 'should';

import golos, { Steem } from '../src/api/index';
import config from '../src/config';
import testPost from './test-post.json';

describe('golos.api:', function () {
  this.timeout(30 * 1000);

  describe('new Steem', () => {
    it('doesn\'t open a connection until required', () => {
      assert(!golos.ws, 'There was a connection on the singleton?');
      assert(!new Steem().ws, 'There was a connection on a new instance?');
    });

    it('opens a connection on demand', (done) => {
      const s = new Steem();
      assert(!new Steem().ws, 'There was a connection on a new instance?');
      s.start();
      process.nextTick(() => {
        assert(s.ws, 'There was no connection?');
        done();
      });
    });
  });

  describe('setWebSocket', () => {
    it('works', () => {
      golos.setWebSocket('ws://localhost');
      config.get('websocket').should.be.eql('ws://localhost');
      config.set('websocket', 'wss://ws.golos.io')
    });
  });

  beforeEach(async () => {
    await golos.apiIdsP;
  });

  describe('getFollowers', () => {
    describe('getting ned\'s followers', () => {
      it('works', async () => {
        const result = await golos.getFollowersAsync('ned', 0, 'blog', 5);
        assert(result, 'getFollowersAsync resoved to null?');
        result.should.have.lengthOf(5);
      });

      it('the startFollower parameter has an impact on the result', async () => {
        // Get the first 5
        const result1 = await golos.getFollowersAsync('ned', 0, 'blog', 5)
        result1.should.have.lengthOf(5);
        const result2 = await golos.getFollowersAsync('ned', result1[result1.length - 1].follower, 'blog', 5)
        result2.should.have.lengthOf(5);
        result1.should.not.be.eql(result2);
      });

      it('clears listeners', async () => {
        golos.listeners('message').should.have.lengthOf(0);
      });
    });
  });

  describe('getContent', () => {
    describe('getting a random post', () => {
      it('works', async () => {
        const result = await golos.getContentAsync('pav', '64yyya-test');
        result.should.have.properties(testPost);
      });

      it('clears listeners', async () => {
        golos.listeners('message').should.have.lengthOf(0);
      });
    });
  });

  describe('streamBlockNumber', () => {
    it('streams golos transactions', (done) => {
      let i = 0;
      const release = golos.streamBlockNumber((err, block) => {
        should.exist(block);
        block.should.be.instanceOf(Number);
        i++;
        if (i === 2) {
          release();
          done();
        }
      });
    });
  });

  describe('streamBlock', () => {
    it('streams golos blocks', (done) => {
      let i = 0;
      const release = golos.streamBlock((err, block) => {
        try {
          should.exist(block);
          block.should.have.properties([
            'previous',
            'transactions',
            'timestamp',
          ]);
        } catch (err) {
          release();
          done(err);
          return;
        }

        i++;
        if (i === 2) {
          release();
          done();
        }
      });
    });
  });

  describe('streamTransactions', () => {
    it('streams golos transactions', (done) => {
      let i = 0;
      const release = golos.streamTransactions((err, transaction) => {
        try {
          should.exist(transaction);
          transaction.should.have.properties([
            'ref_block_num',
            'operations',
            'extensions',
          ]);
        } catch (err) {
          release();
          done(err);
          return;
        }

        i++;
        if (i === 2) {
          release();
          done();
        }
      });
    });
  });

  describe('streamOperations', () => {
    it('streams golos operations', (done) => {
      let i = 0;
      const release = golos.streamOperations((err, operation) => {
        try {
          should.exist(operation);
        } catch (err) {
          release();
          done(err);
          return;
        }

        i++;
        if (i === 2) {
          release();
          done();
        }
      });
    });
  });

  describe('when there are network failures (the ws closes)', () => {
    const originalStart = Steem.prototype.start;
    makeStub(Steem.prototype, 'start', function () {
      return originalStart.apply(this, arguments);
    });

    const originalStop = Steem.prototype.stop;
    makeStub(Steem.prototype, 'stop', function () {
      return originalStop.apply(this, arguments);
    });

    it('tries to reconnect automatically', async () => {
      const golos = new Steem();
      // console.log('RECONNECT TEST start');
      assert(!golos.ws, 'There was a websocket connection before a call?');
      // console.log('RECONNECT TEST make followers call');
      await golos.getFollowersAsync('ned', 0, 'blog', 5);
      assert(golos.ws, 'There was no websocket connection after a call?');
      // console.log('RECONNECT TEST wait 1s');
      await Promise.delay(1000);
      // console.log('RECONNECT TEST simulate close event');
      assert(!golos.stop.calledOnce, 'Steem::stop was already called before disconnect?');
      golos.ws.emit('close');
      assert(!golos.ws);
      assert(!golos.startP);
      assert(golos.stop.calledOnce, 'Steem::stop wasn\'t called when the connection closed?');
      // console.log('RECONNECT TEST make followers call');
      await golos.getFollowersAsync('ned', 0, 'blog', 5);
      assert(golos.ws, 'There was no websocket connection after a call?');
      assert(golos.isOpen, 'There was no websocket connection after a call?');
    });
  });
});
