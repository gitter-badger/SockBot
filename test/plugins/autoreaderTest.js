'use strict';
/*globals describe, it, beforeEach, afterEach*/
/*eslint no-unused-expressions:0 */

const chai = require('chai'),
    sinon = require('sinon');
chai.should();
const expect = chai.expect;

const autoreader = require('../../plugins/autoreader'),
    browserModule = require('../../lib/browser'),
    utils = require('../../lib/utils');
const browser = browserModule();

describe('autoreader', () => {
    it('should export prepare()', () => {
        expect(autoreader.prepare).to.be.a('function');
    });
    it('should export start()', () => {
        expect(autoreader.start).to.be.a('function');
    });
    it('should export stop()', () => {
        expect(autoreader.stop).to.be.a('function');
    });
    it('should export readify()', () => {
        expect(autoreader.readify).to.be.a('function');
    });
    describe('prepare()', () => {
        it('should use default config', () => {
            autoreader.prepare(undefined, undefined, undefined, undefined);
            autoreader.internals.config.minAge.should.equal(3 * 24 * 60 * 60 * 1000);
        });
        it('should override default config', () => {
            autoreader.prepare({
                    minAge: 1 * 24 * 60 * 60 * 1000
                }, undefined, undefined, undefined);
            autoreader.internals.config.minAge.should.equal(1 * 24 * 60 * 60 * 1000);
        });
    });
    describe('start()', () => {
        let sandbox;
        beforeEach(() => {
            sandbox = sinon.sandbox.create();
            sandbox.useFakeTimers();
        });
        afterEach(() => {
            sandbox.restore();
        });
        it('should start timer', () => {
            autoreader.internals.timer = 0;
            autoreader.start();
            expect(autoreader.internals.timer).to.not.be.undefined;
        });
    });
    describe('stop()', () => {
        let sandbox;
        beforeEach(() => {
            sandbox = sinon.sandbox.create();
            sandbox.useFakeTimers();
        });
        afterEach(() => {
            sandbox.restore();
        });
        it('should stop timer', () => {
            autoreader.internals.timer = 1;
            autoreader.stop();
            expect(autoreader.internals.timer).to.be.undefined;
        });
    });
    describe('readify()', () => {
        let sandbox;
        beforeEach(() => {
            sandbox = sinon.sandbox.create();
            sandbox.stub(browser, 'readPosts', (_, __, complete) => {
                    complete();
                });
            sandbox.stub(utils, 'log');
        });
        afterEach(() => {
            sandbox.restore();
        });
        it('should not read anything', () => {
            const spy = sandbox.stub(browser, 'getTopics');
            spy.callsArgWith(0, undefined);
            autoreader.prepare(undefined, undefined, undefined, browser);
            autoreader.readify();
            utils.log.callCount.should.equal(0);
        });
        it('should read the topic', () => {
            const topicSpy = sandbox.stub(browser, 'getTopics');
            topicSpy.callsArgWith(0, {id: 1, slug: 'Test'}, () => 0);
            sandbox.stub(browser, 'getPosts');
            autoreader.prepare(undefined, undefined, undefined, browser);
            autoreader.readify();
            utils.log.calledOnce.should.be.true;
            utils.log.firstCall.calledWith('Reading topic `Test`').should.be.true;
        });
        /*eslint-disable camelcase */
        it('should read the unread post', () => {
            sandbox.stub(browser, 'getTopics', (each, complete) => {
                    each({id: 1, slug: 'Test'}, complete);
                });
            sandbox.stub(browser, 'getPosts', (_, each, complete) => {
                    each({id: 1, read: false, created_at: '2000-01-01 00:00'}, complete);
                });
            autoreader.prepare(undefined, undefined, undefined, browser);
            autoreader.readify();
            utils.log.calledOnce.should.be.true;
            utils.log.firstCall.calledWith('Reading topic `Test`').should.be.true;
            browser.readPosts.calledOnce.should.be.true;
            browser.readPosts.firstCall.args[0].should.equal(1);
            browser.readPosts.firstCall.args[1].should.deep.equal([1]);
        });
        it('should not read the read post', () => {
            sandbox.stub(browser, 'getTopics', (each, complete) => {
                    each({id: 1, slug: 'Test'}, complete);
                });
            sandbox.stub(browser, 'getPosts', (_, each, complete) => {
                    each({id: 1, read: true, created_at: '2000-01-01 00:00'}, complete);
                });
            autoreader.prepare(undefined, undefined, undefined, browser);
            autoreader.readify();
            utils.log.calledOnce.should.be.true;
            utils.log.firstCall.calledWith('Reading topic `Test`').should.be.true;
            browser.readPosts.callCount.should.equal(0);
        });
        it('should not read the unread post that\'s newer than the wait time', () => {
            sandbox.stub(browser, 'getTopics', (each, complete) => {
                    each({id: 1, slug: 'Test'}, complete);
                });
            sandbox.stub(browser, 'getPosts', (_, each, complete) => {
                    each({id: 1, read: false, created_at: '2100-01-01 00:00'}, complete);
                });
            autoreader.prepare(undefined, undefined, undefined, browser);
            autoreader.readify();
            utils.log.calledOnce.should.be.true;
            utils.log.firstCall.calledWith('Reading topic `Test`').should.be.true;
            browser.readPosts.callCount.should.equal(0);
        });
        /*eslint-enable camelcase */
        it('should not read the post that does not exist', () => {
            sandbox.stub(browser, 'getTopics', (each, complete) => {
                    each({id: 1, slug: 'Test'}, complete);
                });
            sandbox.stub(browser, 'getPosts', (_, each, complete) => {
                    each(undefined, complete);
                });
            autoreader.prepare(undefined, undefined, undefined, browser);
            autoreader.readify();
            utils.log.calledOnce.should.be.true;
            utils.log.firstCall.calledWith('Reading topic `Test`').should.be.true;
            browser.readPosts.callCount.should.equal(0);
        });
    });
});
