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
import { AddressInfo, Server } from "net";
import * as rhea from "../";

describe('idle', function () {
    var server: rhea.Container;
    var listener: Server;

    beforeEach(function() {
    })

    afterEach(function () {
        listener.close();
    });

    describe('server has idle_time_out', function () {
        beforeEach(function (done: Function) {
            server = rhea.create_container({ non_fatal_errors: [] });
            listener = server.listen({ port: 0, idle_time_out: 300 });
            listener.on('listening', function () {
                done();
            });
        });

        // There are setups where server detects idle due to suspend while
        // networking and all is well.
        it('client does not send within idle_time_out', function (done: Function) {
            var state = 0;
            server.on('connection_open', function (context: rhea.EventContext) {
                assert.strictEqual(++state, 1);
            });
            server.on('connection_error', function (context: rhea.EventContext) {
                assert.fail('server must not receive error');
            });
            server.on('connection_close', function (context: rhea.EventContext) {
                assert.strictEqual(++state, 4);
            });
            server.on('disconnected', function (context: rhea.EventContext) {
                assert.strictEqual(context.reconnecting, undefined);
                assert.strictEqual(++state, 5);
                setTimeout(() => { done() }, 100);
            });

            var client: rhea.Container = rhea.create_container();
            var conn = client.connect({
                port: (listener.address() as AddressInfo).port
            });
            conn.on('connection_open', function (context: rhea.EventContext) {
                const connection = context.connection;
                assert.strictEqual(++state, 2);
                assert.strictEqual(connection.remote.open.idle_time_out, 300);
                // Disable idle timer
                connection.remote.open.idle_time_out = 0;
                if (connection.heartbeat_out) clearTimeout(connection.heartbeat_out);
            });
            conn.on('connection_error', function (context: rhea.EventContext) {
                assert.strictEqual(++state, 3);
                var error = context.connection.error;
                assert.strictEqual((error as any).condition, 'amqp:resource-limit-exceeded');
                assert.strictEqual((error as any).description, 'max idle time exceeded');
            });
            conn.on('disconnected', function (context: rhea.EventContext) {
                assert.fail('disconnected shouldnt have been called');
            });
        });
    });

    describe('server has no idle_time_out', function () {
        beforeEach(function (done: Function) {
            server = rhea.create_container({ non_fatal_errors: [] });
            listener = server.listen({ port: 0 });
            listener.on('listening', function () {
                done();
            });
        });

        it('server does not send within idle_time_out', function (done: Function) {
            var state = 0;
            var server_opens = 0;
            var server_closes = 0;
            server.on('connection_open', function (context: rhea.EventContext) {
                ++server_opens;
                const connection = context.connection;
                assert.strictEqual(connection.remote.open.idle_time_out, 500);
                if (server_opens == 1) {
                    // Disable idle timer
                    assert.strictEqual(++state, 1);
                    connection.remote.open.idle_time_out = 0;
                    if (connection.heartbeat_out) clearTimeout(connection.heartbeat_out);
                } else {
                    // Reconnect after failure. Just close.
                    assert.strictEqual(++state, 7);
                    connection.close({ condition: 'time to end this test', description: 'well done' })
                }
            });
            server.on('connection_error', function (context: rhea.EventContext) {
                var error = context.connection.error;
                assert.strictEqual((error as any).condition, 'amqp:resource-limit-exceeded');
                assert.strictEqual((error as any).description, 'max idle time exceeded');
                assert.strictEqual(++state, 3);
            });
            server.on('connection_close', function (context: rhea.EventContext) {
                ++server_closes;
                if (server_closes == 1) {
                    assert.strictEqual(++state, 4);
                } else {
                    done();
                }
            });
            server.on('disconnected', function (context: rhea.EventContext) {
                assert.fail('disconnected shouldnt have been called');
            });

            var client: rhea.Container = rhea.create_container();
            var conn = client.connect({
                port: (listener.address() as AddressInfo).port,
                idle_time_out: 500
            });
            var client_opens = 0;
            var client_closes = 0;
            var client_disconnects = 0;
            conn.on('connection_open', function (context: rhea.EventContext) {
                client_opens++;
                assert.strictEqual(client_opens, server_opens);
                if (client_opens === 2) {
                    assert.strictEqual(++state, 8);
                    conn.close();
                } else {
                    assert.strictEqual(++state, 2);
                }
            });
            conn.on('connection_error', function (context: rhea.EventContext) {
                var error = context.connection.error;
                assert.strictEqual((error as any).condition, 'time to end this test');
                assert.strictEqual(++state, 9);
            });
            conn.on('connection_close', function (context: rhea.EventContext) {
                client_closes++;
                if (client_closes == 1) {
                    assert.strictEqual(client_closes, 1);
                    assert.strictEqual(server_opens, 1);
                    assert.strictEqual(client_opens, 1);
                    assert.strictEqual(++state, 5);
                } else {
                    assert.strictEqual(client_closes, 2);
                    assert.strictEqual(server_opens, 2);
                    assert.strictEqual(client_opens, 2);
                    assert.strictEqual(++state, 10);
                }
            });
            conn.on('disconnected', function (context: rhea.EventContext) {
                client_disconnects++;
                assert.strictEqual(client_disconnects, 1);
                assert.strictEqual(server_opens, 1);
                assert.strictEqual(context.reconnecting, true);
                assert.strictEqual(++state, 6);
            });
        });
    });
});
