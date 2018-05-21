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

function create_broker() {
    return {
        listeners: {} as any,
        subscribe: function (address: string, sender: rhea.Sender) {
            this.listeners[address] = sender;
        },
        unsubscribe: function (address: string) {
            delete this.listeners[address];
        },
        publish: function (address: string, message: rhea.Message) {
            var s: rhea.Sender = this.listeners[address];
            if (s) s.send(message);
        }
    };
}

function dummy_broker(capabilities?: any) {
    var container: rhea.Container = rhea.create_container();
    var broker = create_broker();
    if (capabilities) {
        container.on('connection_open', function (context: rhea.EventContext) {
            context.connection.local.open.offered_capabilities = capabilities;
        });
    }
    container.on('sender_open', function (context: rhea.EventContext) {
        if ((context.sender as any).remote.attach.source.dynamic) {
            var temp: string = container.generate_uuid();
            context.sender!.set_source({address:temp});
            broker.subscribe(temp, context.sender!);
        } else {
            broker.subscribe((context.sender as any).remote.attach.source.address, context.sender!);
        }
    });
    container.on('sender_close', function (context: rhea.EventContext) {
        if ((context.sender as any).remote.attach.source.dynamic) {
            broker.unsubscribe((context.sender as any).local.attach.source.address);
        } else {
            broker.unsubscribe((context.sender as any).remote.attach.source.address);
        }
    });
    container.on('message', function (context: rhea.EventContext) {
        var address = (context.receiver as any).remote.attach.target.address || context.message!.to;
        broker.publish(address, context.message!);
    });

    return container.listen({port:0});
}

function reverse(s: string) {
    return s.split("").reverse().join("");
}


describe('rpc', function() {
    this.slow(200);
    var listener: any;

    beforeEach(function(done: Function) {
        listener = dummy_broker(['ANONYMOUS-RELAY']);
        listener.on('listening', function() {
            done();
        });
    });

    afterEach(function() {
        listener.close();
    });

    function get_url(node?: string): string {
        var path: string = node || 'rpc';
        return 'amqp://localhost:' + listener.address().port + '/' + path;
    }

    it('successful invocation', function(done: Function) {
        var url: string = get_url();
        var server: any = (rhea as any).rpc_server(url);
        server.bind(function (s: any, callback: Function) { callback(reverse(s)); }, 'reverse');
        var client = (rhea as any).rpc_client(url);
        client.define('reverse');
        client.reverse('hello', function(result: string, error: any) {
            assert.equal(result, 'olleh');
            assert.equal(error, undefined);
            client.close();
            server.close();
            done();
        });
    });
    it('non-existent procedure', function(done: Function) {
        var url: string = get_url();
        var server: any = (rhea as any).rpc_server(url);
        var client: any = (rhea as any).rpc_client(url);
        client.define('reverse');
        client.reverse('hello', function(result: any, error: Error) {
            assert.equal(result, undefined);
            assert.equal(error.name, 'bad-method');
            client.close();
            done();
        });
    });
    it('failed procedure invocation', function(done: Function) {
        var url: string = get_url();
        var server: any = (rhea as any).rpc_server(url);
        server.bind(function (s: any, callback: Function) { callback(undefined, {name:'bad-mood', description:'I dont like the cut of your jib'}); }, 'foo');
        server.bind(function (s: any, callback: Function) { callback(undefined, 'no joy'); }, 'bar');
        var client: any = (rhea as any).rpc_client(url);
        client.define('foo');
        client.define('bar');
        client.foo('hello', function(result: any, error: any) {
            assert.equal(result, undefined);
            assert.equal(error.name, 'bad-mood');
            assert.equal(error.description, 'I dont like the cut of your jib');
            client.bar('hello', function(result: any, error: any) {
                assert.equal(result, undefined);
                assert.equal(error.name, 'error');
                assert.equal(error.description, 'no joy');
                client.close();
                done();
            });
        });
    });
    it('multiple invocations', function(done: Function) {
        var url: string = get_url();
        var server: any = (rhea as any).rpc_server(url);
        server.bind(function (s: any, callback: Function) { callback(reverse(s)); }, 'reverse');
        server.bind(function (s: any, callback: Function) { callback(s.toUpperCase()); }, 'upper');
        var client: any = (rhea as any).rpc_client(url);
        client.define('reverse');
        client.define('upper');
        client.reverse('hello', function(result: any, error: any) {
            assert.equal(result, 'olleh');
            assert.equal(error, undefined);
            client.upper('shout', function(result: any, error: any) {
                assert.equal(result, 'SHOUT');
                assert.equal(error, undefined);
            });
            client.reverse('goodbye', function(result: any, error: any) {
                assert.equal(result, 'eybdoog');
                assert.equal(error, undefined);
                client.close();
                server.close();
                done();
            });
        });
    });
    it('bind synchronously', function(done: Function) {
        var url: string = get_url();
        var server: any = (rhea as any).rpc_server(url);
        server.bind_sync(reverse);
        var client: any = (rhea as any).rpc_client(url);
        client.define('reverse');
        client.reverse('hello', function(result: any, error: any) {
            assert.equal(result, 'olleh');
            assert.equal(error, undefined);
            client.close();
            server.close();
            done();
        });
    });
});
describe('rpc with anonymous-relay offered as single symbol', function() {
    this.slow(200);
    var listener: any;

    beforeEach(function(done: Function) {
        listener = dummy_broker('ANONYMOUS-RELAY');
        listener.on('listening', function() {
            done();
        });
    });

    afterEach(function() {
        listener.close();
    });

    function get_url(node?: string): string {
        var path = node || 'rpc';
        return 'amqp://localhost:' + listener.address().port + '/' + path;
    }

    it('successful invocation', function(done: Function) {
        var url: string = get_url();
        var server: any = (rhea as any).rpc_server(url);
        server.bind(function (s: any, callback: Function) { callback(reverse(s)); }, 'reverse');
        var client: any = (rhea as any).rpc_client(url);
        client.define('reverse');
        client.reverse('hello', function(result: any, error: any) {
            assert.equal(result, 'olleh');
            assert.equal(error, undefined);
            client.close();
            server.close();
            done();
        });
    });
});
describe('rpc without anonymous-relay', function() {
    this.slow(400);
    var listener: any;

    beforeEach(function(done: Function) {
        listener = dummy_broker();
        listener.on('listening', function() {
            done();
        });
    });

    afterEach(function() {
        listener.close();
    });

    function get_url(node?: string): string {
        var path = node || 'rpc';
        return 'amqp://localhost:' + listener.address().port + '/' + path;
    }

    it('successful invocation', function(done: Function) {
        var url: string = get_url();
        var server: any = (rhea as any).rpc_server(url);
        server.bind(function (s: any, callback: Function) { callback(reverse(s)); }, 'reverse');
        var client: any = (rhea as any).rpc_client(url);
        client.define('reverse');
        client.reverse('hello', function(result: any, error: any) {
            assert.equal(result, 'olleh');
            assert.equal(error, undefined);
            client.close();
            server.close();
            done();
        });
    });
    for (var i = 0; i < 2; i++) {
        it(i === 0 ? 'cache expiry' : 'cache clear', function(done: Function) {
            var url: string = get_url();
            var server: any = (rhea as any).rpc_server(url, {cache_ttl:100});
            server.bind(function (s: any, callback: Function) { callback(reverse(s)); }, 'reverse');
            var client: any = (rhea as any).rpc_client(url);
            client.define('reverse');
            client.reverse('hello', function(result: any, error: any) {
                assert.equal(result, 'olleh');
                assert.equal(error, undefined);
                client.reverse('goodbye', function(result: any, error: any) {
                    assert.equal(result, 'eybdoog');
                    assert.equal(error, undefined);
                    if (i === 0) {
                        setTimeout(function () {
                            client.close();
                            server.close();
                            done();
                        },  300);
                    } else {
                        server.close();
                        client.close();
                        done();
                    }
                });
            });
        });
    }
});
