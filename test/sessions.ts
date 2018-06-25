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


describe('session error handling', function () {
    var container: rhea.Container, listener: any;

    beforeEach(function (done: Function) {
        container = rhea.create_container();
        listener = container.listen({ port: 0 });
        listener.on('listening', function () {
            done();
        });
    });

    afterEach(function () {
        listener.close();
    });

    it('error and close handled', function (done: Function) {
        var error_handler_called: boolean;
        var close_handler_called: boolean;
        container.on('session_open', function (context: rhea.EventContext) {
            context.session.close({ condition: 'amqp:internal-error', description: 'testing error on close' });
        });
        container.on('session_close', function (context) {
            assert.equal(error_handler_called, true);
            assert.equal(close_handler_called, true);
        });
        var c: rhea.Connection = container.connect(listener.address());
        c.on('connection_close', function (context: rhea.EventContext) {
            done();
        });
        var s = c.create_session();
        s.begin();
        s.on('session_error', function (context: rhea.EventContext) {
            error_handler_called = true;
            var error = context.session.error;
            assert.equal((error as any).condition, 'amqp:internal-error');
            assert.equal((error as any).description, 'testing error on close');
        });
        s.on('session_close', function (context: rhea.EventContext) {
            close_handler_called = true;
            var error = context.session.error;
            assert.equal((error as any).condition, 'amqp:internal-error');
            assert.equal((error as any).description, 'testing error on close');
            context.connection.close();
        });
    });
    it('error handled', function (done: Function) {
        var error_handler_called: boolean;
        container.on('session_open', function (context: rhea.EventContext) {
            context.session.close({ condition: 'amqp:internal-error', description: 'testing error on close' });
        });
        container.on('session_close', function (context) {
            assert.equal(error_handler_called, true);
            context.connection.close();
        });
        container.on('connection_close', function (context: rhea.EventContext) {
            done();
        });
        var c: rhea.Connection = rhea.create_container({ non_fatal_errors: [] }).connect(listener.address());
        var s = c.create_session();
        s.begin();
        s.on('session_error', function (context: rhea.EventContext) {
            error_handler_called = true;
            var error = context.session.error;
            assert.equal((error as any).condition, 'amqp:internal-error');
            assert.equal((error as any).description, 'testing error on close');
        });
    });
    it('unhandled error', function (done: Function) {
        container.on('session_open', function (context: rhea.EventContext) {
            context.session.close({ condition: 'amqp:internal-error', description: 'testing error on close' });
        });
        container.on('connection_close', function (context: rhea.EventContext) {
            done();
        });
        var container2 = rhea.create_container({ non_fatal_errors: [] });
        container2.on('error', function (error: rhea.AmqpError) {
            assert.equal((error as any).condition, 'amqp:internal-error');
            assert.equal((error as any).description, 'testing error on close');
            (error as any).session.connection.close();
        });
        var c: rhea.Connection = container2.connect(listener.address());
        var s = c.create_session();
        s.begin();
    });
});
