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
var rhea = require('rhea');

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
});
