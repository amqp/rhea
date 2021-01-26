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

describe('sasl plain', function() {
    this.slow(200);
    var container: rhea.Container, listener: any;

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

describe('sasl plain callback using promise', function() {
    this.slow(200);
    var container: rhea.Container, listener: any;
    var providerFailure : boolean;

    function authenticate(username: string, password: string) {
        return new Promise((resolve, reject) => {
            process.nextTick(() => {
                if (providerFailure) {
                    reject("provider failure");
                } else {
                    resolve(username.split("").reverse().join("") === password);
                }
            })
        });
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
    it('handles authentication provider failure', function(done: Function) {
        providerFailure = true;
        // Swallow the expected server side report of the provider failure
        container.on('connection_error', function () {});

        let connection = container.connect({username:'whatsit',password:'anyoldrubbish',port:listener.address().port});
        connection.on('connection_error', function(context) {
            var error = context.connection.get_error();
            assert.equal(error.condition, 'amqp:internal-error');
            done();
        });
    });
});

describe('sasl init hostname', function() {
    this.slow(200);
    var container: rhea.Container, listener: any, hostname: string | undefined;

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
        container.connect({username:'a',password:'a', host:'localhost', port:listener.address().port}).on('connection_open', function(context: rhea.EventContext) {
            context.connection.close();
            assert.equal(hostname, 'localhost');
            done();
        });
    });

    it('prefers servername to host', function(done: Function) {
        container.connect({username:'a',password:'b', servername:'somethingelse', host:'localhost', port:listener.address().port}).on('connection_open', function(context: rhea.EventContext) {
            context.connection.close();
            assert.equal(hostname, 'somethingelse');
            done();
        });
    });

    it('prefers sasl_init_hostname to servername or host', function(done: Function) {
        container.connect({username:'a',password:'b', sasl_init_hostname:'yetanother', servername:'somethingelse', host:'localhost', port:listener.address().port}).on('connection_open', function(context: rhea.EventContext) {
            context.connection.close();
            assert.equal(hostname, 'yetanother');
            done();
        });
    });
});


describe('sasl anonymous', function() {
    this.slow(200);

    var container: rhea.Container, listener: any;

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
        container.connect({username:'whatsit',password:'anyoldrubbish',port:listener.address().port}).on('connection_error', function(context: rhea.EventContext) {
            var error = context.connection.get_error();
            assert.equal((error as rhea.AmqpError).condition, 'amqp:unauthorized-access');
            assert.equal((error as rhea.AmqpError).description, 'No suitable mechanism; server supports ANONYMOUS');
            done();
        });
    });
});

describe('user-provided sasl mechanism', function () {
    var container: rhea.Container, listener: any;
    var testClientSaslMechanism = {
        start: function (callback: Function) { callback(null, 'initialResponse'); },
        step: function (challenge: any, callback: Function) { callback (null, 'challengeResponse'); }
    };

    beforeEach(function(done: Function) {
        container = rhea.create_container();
        container.on('disconnected', function () {});
        listener = container.listen({port:0});
        listener.on('listening', function() {
            done();
        });
    });

    afterEach(function() {
        listener.close();
    });

    it('calls start and step on the custom sasl mechanism', function (done: Function) {
        var startCalled = false;
        var stepCalled = false;
        var connectOptions = {
            sasl_mechanisms: {
                'CUSTOM': testClientSaslMechanism
            },
            port: listener.address().port
        }

        container.sasl_server_mechanisms['CUSTOM'] = function () {
            return {
                outcome: undefined,
                start: function () {
                    startCalled = true;
                    return 'initialResponse';
                },
                step: function () {
                    stepCalled = true;
                    this.outcome = <any>true;
                    return;
                }
            };
        };

        container.connect(connectOptions).on('connection_open', function(context) {
            context.connection.close();
            assert(startCalled);
            assert(stepCalled);
            done();
        });
    });

    it('handles authentication failure if the custom server sasl mechanism fails', function (done: Function) {
        var startCalled = false;
        var stepCalled = false;
        var connectOptions = {
            sasl_mechanisms: {
                'CUSTOM': testClientSaslMechanism
            },
            port: listener.address().port
        }

        container.sasl_server_mechanisms['CUSTOM'] = function () {
            return {
                outcome: undefined,
                start: function () {
                    startCalled = true;
                    return 'initialResponse';
                },
                step: function () {
                    stepCalled = true;
                    this.outcome = <any>false;
                    return;
                }
            };
        };

        container.connect(connectOptions).on('connection_error', function(context) {
            var error = context.connection.get_error();
            assert.equal(error.condition, 'amqp:unauthorized-access');
            assert(startCalled);
            assert(stepCalled);
            done();
        });
    });

    it('calls start and step on the custom sasl mechanism using promises', function (done: Function) {
        var startCalled = false;
        var stepCalled = false;
        var connectOptions = {
            sasl_mechanisms: {
                'CUSTOM': testClientSaslMechanism
            },
            port: listener.address().port
        }

        container.sasl_server_mechanisms['CUSTOM'] = function () {
            return {
                outcome: undefined,
                start: function () {
                    return new Promise(resolve => {
                        process.nextTick(() => {
                            startCalled = true;
                            resolve('initialResponse');
                        });
                    });
                },
                step: function () {
                    return new Promise<void>(resolve => {
                        process.nextTick(() => {
                            stepCalled = true;
                            this.outcome = <any>true;
                            resolve();
                        });
                    });
                }
            };
        };

        container.connect(connectOptions).on('connection_open', function(context) {
            context.connection.close();
            assert(startCalled);
            assert(stepCalled);
            done();
        });
    });

});