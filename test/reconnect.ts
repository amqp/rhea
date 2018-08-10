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

import * as assert from "assert";
import * as rhea from "../";


function add(map: any, key: string, value: any) {
    map[key] = value;
    return map;
}

describe('reconnect', function() {
    this.slow(150);
    var listener: any, socket: any;

    beforeEach(function(done: Function) {
        var count: number = 0;
        var container: rhea.Container = rhea.create_container();
        container.on('connection_open', function(context) {
            count++;
            context.connection.local.open.hostname = 'test' + count;
        });
        container.on('disconnected', function (context) {});
        listener = container.listen({port:0});
        listener.on('connection', function (s: any) {
            socket = s;
        });
        listener.on('listening', function() {
            done();
        });
    });

    afterEach(function() {
        listener.close();
    });

    it('reconnects successfully', function(done: Function) {
        var container: rhea.Container = rhea.create_container();
        var count: number = 0;
        var disconnects: number = 0;
        var c: rhea.Connection = container.connect(add(listener.address(), 'reconnect_limit', 10));
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
    it('stops trying after limit reached', function(done: Function) {
        var container: rhea.Container = rhea.create_container();
        var count: number = 0;
        var disconnects: number = 0;
        var c: rhea.Connection = container.connect(add({port:65535}, 'reconnect_limit', 3));
        container.on('connection_error', function () {});
        c.on('disconnected', function (context: rhea.EventContext) {
            disconnects++;
            if (!context.reconnecting) {
                assert.equal(disconnects, 4/*first disconnection + 3 failed reconnect attempts*/);
                done();
            }
        });
    });
    it('re-establishes link successfully', function(done: Function) {
        var container: rhea.Container = rhea.create_container();
        var count: number = 0;
        var disconnects: number = 0;
        var c: rhea.Connection = container.connect(listener.address());
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
    it('does not re-establish removed link', function(done: Function) {
        var container: rhea.Container = rhea.create_container();
        var receiver_opens: number = 0;
        var sender_opens: number= 0;
        var disconnects: number = 0;
        var c: rhea.Connection = container.connect(listener.address());
        var r: rhea.Receiver = c.open_receiver('my-receiver');
        var s: rhea.Sender = c.open_sender('my-sender');
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
    it('does not re-establish removed session', function(done: Function) {
        var container: rhea.Container = rhea.create_container();
        var sender_opens: number = 0;
        var extra_session_opens: number = 0;
        var disconnects: number = 0;
        var c: rhea.Connection = container.connect(listener.address());
        var s: rhea.Sender = c.open_sender('my-sender');
        var extra_session: rhea.Session = c.create_session();
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
    it('does not reconnect when disabled', function(done: Function) {
        var container: rhea.Container = rhea.create_container();
        var count: number = 0;
        var disconnects: number = 0;
        var c: rhea.Connection = container.connect(add(listener.address(), 'reconnect', false));
        var receiver: rhea.Receiver = c.open_receiver('foo');
        var sender: rhea.Sender = c.open_sender('foo');
        c.on('disconnected', function (context) {
            disconnects++;
            assert.equal(receiver.is_open(), false);
            assert.equal(sender.is_open(), false);
            //wait before exiting to ensure no reconnect attempt is made
            setTimeout(function () {
                assert.equal(disconnects, 1);
                done();
            }, 500);
        });
        c.on('connection_open', function (context) {
            count++;
            assert.equal(count, 1);
        });
        c.on('sender_open', function (context) {
            socket.end();
        });
    });
});

describe('non-fatal error', function() {
    this.slow(150);
    var listener: any, socket: any;

    beforeEach(function(done: Function) {
        var count: number = 0;
        var container: rhea.Container = rhea.create_container();
        container.on('connection_open', function(context) {
            count++;
            context.connection.local.open.hostname = 'test' + count;
            context.connection.close({ condition: 'amqp:connection:forced', description: 'testing non-fatal error'});
        });
        container.on('disconnected', function (context) {});
        listener = container.listen({port:0});
        listener.on('connection', function (s: any) {
            socket = s;
        });
        listener.on('listening', function() {
            done();
        });
    });

    afterEach(function() {
        listener.close();
    });
    it('emits disconnected event when reconnect when disabled', function(done: Function) {
        var container: rhea.Container = rhea.create_container();
        var c: rhea.Connection = container.connect(add(listener.address(), 'reconnect', false));
        c.on('disconnected', function (context) {
            done();
        });
    });
});
