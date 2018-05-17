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
import * as rhea from "rhea";

describe('sasl plain', function() {
    this.slow(200);
    var container: rhea.IContainer, listener: any;

    function authenticate(username: string, password: string) {
        return username.split("").reverse().join("") === password;
    }

    beforeEach(function(done: Function) {
        container = rhea.create_container();
        container.sasl_server_mechanisms.enable_plain(authenticate);
        container.on('disconnected', function () {});
        listener = container.listen({port:0});
        listener.on('listening', function() {
            done();
        });
    });

    afterEach(function() {
        listener.close();
    });

    it('successfully authenticates', function(done: Function) {
        container.connect({username:'bob',password:'bob',port:listener.address().port}).on('connection_open', function(context) { context.connection.close(); done(); });
    });
    it('handles authentication failure', function(done: Function) {
        container.connect({username:'whatsit',password:'anyoldrubbish',port:listener.address().port}).on('connection_error', function(context) { 
            var error = context.connection.get_error();
            assert.equal(error.condition, 'amqp:unauthorized-access');
            done();
        });
    });
});

describe('sasl init hostname', function() {
    this.slow(200);
    var container: rhea.IContainer, listener: any, hostname: string | undefined;

    function authenticate(username: string, password: string, __hostname: string): boolean {
        hostname = __hostname;
        return true;
    }

    beforeEach(function(done: Function) {
        hostname = undefined;
        container = rhea.create_container();
        container.sasl_server_mechanisms.enable_plain(authenticate);
        container.on('disconnected', function () {});
        listener = container.listen({port:0});
        listener.on('listening', function() {
            done();
        });
    });

    afterEach(function() {
        listener.close();
    });

    it('uses host by default', function(done: Function) {
        container.connect({username:'a',password:'a', host:'localhost', port:listener.address().port}).on('connection_open', function(context: rhea.Context) {
            context.connection.close();
            assert.equal(hostname, 'localhost');
            done();
        });
    });

    it('prefers servername to host', function(done: Function) {
        container.connect({username:'a',password:'b', servername:'somethingelse', host:'localhost', port:listener.address().port}).on('connection_open', function(context: rhea.Context) {
            context.connection.close();
            assert.equal(hostname, 'somethingelse');
            done();
        });
    });

    it('prefers sasl_init_hostname to servername or host', function(done: Function) {
        container.connect({username:'a',password:'b', sasl_init_hostname:'yetanother', servername:'somethingelse', host:'localhost', port:listener.address().port}).on('connection_open', function(context: rhea.Context) {
            context.connection.close();
            assert.equal(hostname, 'yetanother');
            done();
        });
    });
});


describe('sasl anonymous', function() {
    this.slow(200);

    var container: rhea.IContainer, listener: any;

    beforeEach(function(done: Function) {
        container = rhea.create_container();
        container.sasl_server_mechanisms.enable_anonymous();
        container.on('disconnected', function () {});
        listener = container.listen({port:0});
        listener.on('listening', function() {
            done();
        });
    });

    afterEach(function() {
        listener.close();
    });

    it('successfully authenticates', function(done: Function) {
        container.connect({username:'bob',port:listener.address().port}).on('connection_open', function(context) { context.connection.close(); done(); });
    });
    it('handles authentication failure', function(done: Function) {
        container.connect({username:'whatsit',password:'anyoldrubbish',port:listener.address().port}).on('connection_error', function(context: rhea.Context) {
            var error = context.connection.get_error();
            assert.equal((error as rhea.AmqpError).condition, 'amqp:unauthorized-access');
            assert.equal((error as rhea.AmqpError).description, 'No suitable mechanism; server supports ANONYMOUS');
            done();
        });
    });
});
