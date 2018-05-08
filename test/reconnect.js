/*
 * Copyright 2015 Red Hat Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

var assert = require('assert');
var rhea = require('../lib/container.js');

describe('reconnect', function() {
    this.slow(150);
    var listener, socket;

    beforeEach(function(done) {
        var count = 0;
        var container = rhea.create_container();
        container.on('connection_open', function(context) {
            count++;
            context.connection.local.open.hostname = 'test' + count;
        });
        container.on('disconnected', function (context) {});
        listener = container.listen({port:0});
        listener.on('connection', function (s) {
            socket = s;
        });
        listener.on('listening', function() {
            done();
        });
    });

    afterEach(function() {
        listener.close();
    });

    function add(map, key, value) {
        map[key] = value;
        return map;
    }

    it('reconnects successfully', function(done) {
        var container = rhea.create_container();
        var count = 0;
        var disconnects = 0;
        var c = container.connect(add(listener.address(), 'reconnect_limit', 10));
        c.on('disconnected', function (context) {
            disconnects++;
        });
        c.on('connection_open', function (context) {
            count++;
            assert.equal(context.connection.remote.open.hostname, 'test' + count);
            if (count === 1) {
                socket.end();
            } else {
                assert.equal(disconnects, 1);
                context.connection.close();
                done();
            }
        });
    });
    it('stops trying after limit reached', function(done) {
        var container = rhea.create_container();
        var count = 0;
        var disconnects = 0;
        var c = container.connect(add({port:65535}, 'reconnect_limit', 3));
        container.on('connection_error', function () {});
        c.on('disconnected', function (context) {
            disconnects++;
            if (!context.reconnecting) {
                assert.equal(disconnects, 4/*first disconnection + 3 failed reconnect attempts*/);
                done();
            }
        });
    });
    it('re-establishes link successfully', function(done) {
        var container = rhea.create_container();
        var count = 0;
        var disconnects = 0;
        var c = container.connect(listener.address());
        c.open_sender('my-sender');
        c.on('disconnected', function (context) {
            disconnects++;
        });
        c.on('sender_open', function (context) {
            count++;
            assert.equal(context.connection.remote.open.hostname, 'test' + count);
            if (count === 1) {
                socket.end();
            } else {
                assert.equal(disconnects, 1);
                context.connection.close();
                done();
            }
        });
    });
    it('does not re-establish removed link', function(done) {
        var container = rhea.create_container();
        var receiver_opens = 0;
        var sender_opens = 0;
        var disconnects = 0;
        var c = container.connect(listener.address());
        var r = c.open_receiver('my-receiver');
        var s = c.open_sender('my-sender');
        c.on('disconnected', function (context) {
            disconnects++;
            r.remove();
        });
        c.on('receiver_open', function (context) {
            assert.equal(++receiver_opens, 1);
            assert.equal(context.connection.remote.open.hostname, 'test' + receiver_opens);
        });
        c.on('sender_open', function (context) {
            sender_opens++;
            assert.equal(context.connection.remote.open.hostname, 'test' + sender_opens);
            if (sender_opens === 1) {
                socket.end();
            } else {
                assert.equal(disconnects, 1);
                assert.equal(receiver_opens, 1);
                context.connection.close();
                done();
            }
        });
    });
    it('does not re-establish removed session', function(done) {
        var container = rhea.create_container();
        var sender_opens = 0;
        var extra_session_opens = 0;
        var disconnects = 0;
        var c = container.connect(listener.address());
        var s = c.open_sender('my-sender');
        var extra_session = c.create_session();
        extra_session.begin();
        extra_session.on('session_open', function () {
            assert.equal(disconnects, 0);
            assert.equal(++extra_session_opens, 1);
        });
        c.on('disconnected', function (context) {
            disconnects++;
            extra_session.remove();
        });
        c.on('sender_open', function (context) {
            sender_opens++;
            assert.equal(context.connection.remote.open.hostname, 'test' + sender_opens);
            if (sender_opens === 1) {
                socket.end();
            } else {
                assert.equal(disconnects, 1);
                assert.equal(extra_session_opens, 1);
                context.connection.close();
                done();
            }
        });
    });
});
