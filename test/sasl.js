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

describe('sasl plain', function() {
    this.slow(100);
    var container, listener;

    function authenticate(username, password) {
        return username.split("").reverse().join("") === password;
    }

    beforeEach(function(done) {
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

    it('successfully authenticates', function(done) {
        container.connect({username:'bob',password:'bob',port:listener.address().port}).on('connection_open', function(context) { context.connection.close(); done(); });
    });
    it('handles authentication failure', function(done) {
        container.connect({username:'whatsit',password:'anyoldrubbish',port:listener.address().port}).on('connection_error', function(context) { 
            var error = context.connection.get_error();
            assert.equal(error.condition, 'amqp:unauthorized-access');
            done();
        });
    });
});


describe('sasl anonymous', function() {
    this.slow(100);

    var container, listener;

    beforeEach(function(done) {
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

    it('successfully authenticates', function(done) {
        container.connect({username:'bob',port:listener.address().port}).on('connection_open', function(context) { context.connection.close(); done(); });
    });
    it('handles authentication failure', function(done) {
        container.connect({username:'whatsit',password:'anyoldrubbish',port:listener.address().port}).on('connection_error', function(context) {
            var error = context.connection.get_error();
            assert.equal(error.condition, 'amqp:unauthorized-access');
            assert.equal(error.description, 'No suitable mechanism; server supports ANONYMOUS');
            done();
        });
    });
});
