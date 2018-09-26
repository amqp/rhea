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

import * as fs from "fs";
import * as assert from "assert";
import * as rhea from "../";

describe('connection fields', function () {
    var container: rhea.Container, listener: any;
    beforeEach(function (done: Function) {
        container = rhea.create_container({ non_fatal_errors: [] });
        listener = container.listen({ port: 0 });
        listener.on('listening', function () {
            done();
        });
    });

    function open_test(fields: any, verification: Function) {
        return function (done: Function) {
            container.on('connection_open', function (context: rhea.EventContext) {
                verification(context.connection);
                context.connection.close()
                done();
            });
            fields.port = listener.address().port;
            container.connect(fields).on('connection_open', function (context: rhea.EventContext) { });
        };
    }

    function close_test(error: any, verification: Function) {
        return function (done: Function) {
            container.on('connection_close', function (context: rhea.EventContext) {
                verification(context.connection);
                done();
            });
            var c = container.connect(listener.address());
            c.on('connection_open', function (context: rhea.EventContext) {
                context.connection.local.close.error = error;
                context.connection.close();
            });
            c.on('connection_close', function (context) {
                assert.equal(context.connection.is_closed(), true);
            });
        };
    }
    function close_test_simple(error: any, verification: Function) {
        return function (done: Function) {
            container.on('connection_close', function (context: rhea.EventContext) {
                verification(context.connection);
                done();
            });
            var c = container.connect(listener.address());
            c.on('connection_open', function (context: rhea.EventContext) {
                context.connection.close(error);
            });
            c.on('connection_close', function (context: rhea.EventContext) { });
        };
    }

    afterEach(function () {
        listener.close();
    });

    it('single offered capability', open_test({ offered_capabilities: 'foo' }, function (connection: rhea.Connection) {
        assert.equal(connection.remote.open.offered_capabilities, 'foo');
    }));
    it('multiple offered capabilities', open_test({ offered_capabilities: ['foo', 'bar'] }, function (connection: rhea.Connection) {
        assert.equal(connection.remote.open.offered_capabilities.length, 2);
        assert.equal(connection.remote.open.offered_capabilities[0], 'foo');
        assert.equal(connection.remote.open.offered_capabilities[1], 'bar');
    }));
    it('single desired capability', open_test({ desired_capabilities: 'foo' }, function (connection: rhea.Connection) {
        assert.equal(connection.remote.open.desired_capabilities, 'foo');
    }));
    it('multiple desired capabilities', open_test({ desired_capabilities: ['a', 'b', 'c'] }, function (connection: rhea.Connection) {
        assert.equal(connection.remote.open.desired_capabilities.length, 3);
        assert.equal(connection.remote.open.desired_capabilities[0], 'a');
        assert.equal(connection.remote.open.desired_capabilities[1], 'b');
        assert.equal(connection.remote.open.desired_capabilities[2], 'c');
    }));
    it('hostname explicit', open_test({ hostname: 'my-virtual-host' }, function (connection: rhea.Connection) {
        assert.equal(connection.remote.open.hostname, 'my-virtual-host');
    }));
    it('hostname aliased', open_test({ hostname: 'my-virtual-host' }, function (connection: rhea.Connection) {
        assert.equal(connection.hostname, 'my-virtual-host');
    }));
    it('container_id explicit', open_test({ container_id: 'this-is-me' }, function (connection: rhea.Connection) {
        assert.equal(connection.remote.open.container_id, 'this-is-me');
    }));
    it('container_id aliased', open_test({ container_id: 'this-is-me' }, function (connection: rhea.Connection) {
        assert.equal(connection.container_id, 'this-is-me');
    }));
    it('max frame size explicit', open_test({ max_frame_size: 5432 }, function (connection: rhea.Connection) {
        assert.equal(connection.remote.open.max_frame_size, 5432);
    }));
    it('max frame size aliased', open_test({ max_frame_size: 5432 }, function (connection: rhea.Connection) {
        assert.equal(connection.max_frame_size, 5432);
    }));
    it('channel max explicit', open_test({ channel_max: 10 }, function (connection: rhea.Connection) {
        assert.equal(connection.remote.open.channel_max, 10);
    }));
    it('channel max aliased', open_test({ channel_max: 10 }, function (connection: rhea.Connection) {
        assert.equal(connection.channel_max, 10);
    }));
    it('idle time out explicit', open_test({ idle_time_out: 1000 }, function (connection: rhea.Connection) {
        assert.equal(connection.remote.open.idle_time_out, 1000);
    }));
    it('idle time out aliased', open_test({ idle_time_out: 1000 }, function (connection: rhea.Connection) {
        assert.equal(connection.idle_time_out, 1000);
    }));
    it('properties explicit', open_test({ properties: { flavour: 'vanilla', scoops: 2, cone: true } }, function (connection: rhea.Connection) {
        assert.equal(connection.remote.open.properties.flavour, 'vanilla');
        assert.equal(connection.remote.open.properties.scoops, 2);
        assert.equal(connection.remote.open.properties.cone, true);
    }));
    it('properties aliased', open_test({ properties: { flavour: 'vanilla', scoops: 2, cone: true } }, function (connection: rhea.Connection) {
        assert.equal(connection!.properties!.flavour, 'vanilla');
        assert.equal(connection!.properties!.scoops, 2);
        assert.equal(connection!.properties!.cone, true);
    }));
    it('error on close', close_test({ condition: 'amqp:connection:forced', description: 'testing error on close' }, function (connection: rhea.Connection) {
        var error = connection.remote.close.error;
        assert.equal((error as any).condition, 'amqp:connection:forced');
        assert.equal((error as any).description, 'testing error on close');
        assert.equal(connection.is_closed(), false);
    }));
    it('pass error to close', close_test_simple({ condition: 'amqp:connection:forced', description: 'testing error on close' }, function (connection: rhea.Connection) {
        var error = connection.remote.close.error;
        assert.equal((error as any).condition, 'amqp:connection:forced');
        assert.equal((error as any).description, 'testing error on close');
    }));
});
describe('connection error handling', function () {
    var container: rhea.Container, listener: any;

    beforeEach(function (done: Function) {
        container = rhea.create_container();
        container.options.non_fatal_errors = [];
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
        container.on('connection_open', function (context: rhea.EventContext) {
            context.connection.close({ condition: 'amqp:connection:forced', description: 'testing error on close' });
        });
        container.on('connection_close', function (context: rhea.EventContext) {
            assert.equal(error_handler_called, true);
            assert.equal(close_handler_called, true);
            done();
        });
        var c: rhea.Connection = container.connect(listener.address());
        c.on('connection_error', function (context: rhea.EventContext) {
            error_handler_called = true;
            var error = context.connection.error;
            assert.equal((error as any).condition, 'amqp:connection:forced');
            assert.equal((error as any).description, 'testing error on close');
        });
        c.on('connection_close', function (context: rhea.EventContext) {
            close_handler_called = true;
            var error = context.connection.error;
            assert.equal((error as any).condition, 'amqp:connection:forced');
            assert.equal((error as any).description, 'testing error on close');
        });
    });
    it('error handled', function (done: Function) {
        var error_handler_called: boolean;
        container.on('connection_open', function (context: rhea.EventContext) {
            context.connection.close({ condition: 'amqp:connection:forced', description: 'testing error on close' });
        });
        container.on('connection_close', function () {
            assert.equal(error_handler_called, true);
            done();
        });
        var c: rhea.Connection = rhea.create_container({ non_fatal_errors: [] }).connect(listener.address());
        c.on('connection_error', function (context: rhea.EventContext) {
            error_handler_called = true;
            var error = context.connection.error;
            assert.equal((error as any).condition, 'amqp:connection:forced');
            assert.equal((error as any).description, 'testing error on close');
        });
    });
    it('unhandled error', function (done: Function) {
        container.on('connection_open', function (context: rhea.EventContext) {
            context.connection.close({ condition: 'amqp:connection:forced', description: 'testing error on close' });
        });
        container.on('connection_close', function (context: rhea.EventContext) {
            done();
        });
        var container2 = rhea.create_container({ non_fatal_errors: [] });
        container2.on('error', function (error: rhea.AmqpError) {
            assert.equal((error as any).condition, 'amqp:connection:forced');
            assert.equal((error as any).description, 'testing error on close');
        });
        var c: rhea.Connection = container2.connect(listener.address());
    });
});

describe('connection events', function () {
    var listener: any;

    beforeEach(function (done: Function) {
        var container = rhea.create_container();
        container.on('connection_open', function (context: rhea.EventContext) {
            var conn = context.connection;
            conn.local.open.offered_capabilities = conn.remote.open.desired_capabilities;
        });
        listener = container.listen({ port: 0 });
        listener.on('listening', function () {
            done();
        });
    });

    afterEach(function () {
        listener.close();
    });

    it('dispatches events to correct handlers', function (done: Function) {
        var latch: any = {
            count: 3,
            decrement: function () {
                if (--this.count == 0) done();
            }
        };
        var container: rhea.Container = rhea.create_container();

        var c1: rhea.Connection = container.connect({ port: listener.address().port, desired_capabilities: 'one' });
        c1.on('connection_open', function (context: rhea.EventContext) {
            assert.equal(context.connection.remote.open.offered_capabilities, 'one');
            latch.decrement();
            context.connection.close();
        });
        var c2: rhea.Connection = container.connect({ port: listener.address().port, desired_capabilities: 'two' });
        c2.on('connection_open', function (context: rhea.EventContext) {
            assert.equal(context.connection.remote.open.offered_capabilities, 'two');
            latch.decrement();
            context.connection.close();
        });
        var c3: rhea.Connection = container.connect({ port: listener.address().port, desired_capabilities: 'three' });
        //third connection has no handler defined, so will default to container level handler:
        container.on('connection_open', function (context: rhea.EventContext) {
            assert.equal(context.connection.remote.open.offered_capabilities, 'three');
            latch.decrement();
            context.connection.close();
        });
    });
});

describe('container id', function () {
    var listener: any;
    var client_container_name: string;

    beforeEach(function (done: Function) {
        var container: rhea.Container = rhea.create_container({ id: 'my-server-container' });
        container.on('connection_open', function (context: rhea.EventContext) {
            client_container_name = context.connection.remote.open.container_id;
        });
        listener = container.listen({ port: 0 });
        listener.on('listening', function () {
            done();
        });
    });

    afterEach(function () {
        listener.close();
    });

    it('correctly sets desired container id', function (done: Function) {
        var container: rhea.Container = rhea.create_container({ id: 'my-client-container' });

        var c1: rhea.Connection = container.connect(listener.address());
        c1.on('connection_open', function (context: rhea.EventContext) {
            assert.equal(context.connection.remote.open.container_id, 'my-server-container');
            assert.equal(client_container_name, 'my-client-container');
            context.connection.close();
            done();
        });
    });
});

describe('connection send', function () {
    var listener: any;
    var received: any = {};

    beforeEach(function (done: Function) {
        var container: rhea.Container = rhea.create_container();
        container.on('message', function (context: rhea.EventContext) {
            received[context.message!.to!] = context.message!.body;
        });
        listener = container.listen({ port: 0 });
        listener.on('listening', function () {
            done();
        });
    });

    afterEach(function () {
        listener.close();
        received = {};
    });

    it('sends message via default sender', function (done: Function) {
        var container: rhea.Container = rhea.create_container();

        var c: rhea.Connection = container.connect(listener.address());
        var count = 0;
        c.on('accepted', function (context: rhea.EventContext) {
            if (++count === 2) {
                assert.equal(received['a'], 'A');
                assert.equal(received['b'], 'B');
                context.sender!.close();
                context.connection!.close();
                done();
            }
        });
        c.send({ to: 'a', body: 'A' });
        c.send({ to: 'b', body: 'B' });
    });
});

describe('link lookup and iteration', function () {
    var listener: any;

    beforeEach(function (done: Function) {
        var container: rhea.Container = rhea.create_container();
        listener = container.listen({ port: 0 });
        listener.on('listening', function () {
            done();
        });
    });

    afterEach(function () {
        listener.close();
    });

    it('finds sender or receiver', function (done: Function) {
        var container: rhea.Container = rhea.create_container();
        var conn = container.connect(listener.address());
        var r1: rhea.Receiver = conn.open_receiver({ name: 'foo' });
        var r2: rhea.Receiver = conn.open_receiver({ name: 'bar' });
        var s1: rhea.Sender = conn.open_sender({ name: 'oof' });
        var s2: rhea.Sender = conn.open_sender({ name: 'rab' });
        conn.on('connection_open', function () {
            assert.equal(conn.find_receiver(function (r: rhea.Receiver) { return r.name === 'foo'; }), r1);
            assert.equal(conn.find_receiver(function (r: rhea.Receiver) { return r.name === 'bar'; }), r2);
            assert(conn.find_receiver(function (r: rhea.Receiver) { return false; }) === undefined);
            assert.equal(conn.find_sender(function (s: rhea.Sender) { return s.name === 'oof'; }), s1);
            assert.equal(conn.find_sender(function (s: rhea.Sender) { return s.name === 'rab'; }), s2);
            assert(conn.find_sender(function (s: rhea.Sender) { return false; }) === undefined);
            conn.close();
        });
        conn.on('connection_close', function () {
            done();
        });
    });
    it('iterates over senders or receivers', function (done: Function) {
        var container: rhea.Container = rhea.create_container();
        var conn: rhea.Connection = container.connect(listener.address());
        var r1: rhea.Receiver = conn.open_receiver({ name: 'foo' });
        var r2: rhea.Receiver = conn.open_receiver({ name: 'bar' });
        var s1: rhea.Sender = conn.open_sender({ name: 'oof' });
        var s2: rhea.Sender = conn.open_sender({ name: 'rab' });
        conn.on('connection_open', function () {
            var results: any[] = [];
            function collect(o: any) {
                results.push(o.name);
            }
            conn.each_receiver(collect);
            assert.deepEqual(results, ['foo', 'bar']);
            results = [];
            conn.each_sender(collect);
            assert.deepEqual(results, ['oof', 'rab']);
            results = [];
            conn.each_link(collect);
            assert.deepEqual(results, ['foo', 'bar', 'oof', 'rab']);
            conn.close();
        });
        conn.on('connection_close', function () {
            done();
        });
    });
});

describe('container create connection', function () {
    var listener: any;
    var received: any = {};

    beforeEach(function (done: Function) {
        var container: rhea.Container = rhea.create_container();
        container.on('message', function (context: rhea.EventContext) {
            received[context.message!.to!] = context.message!.body;
        });
        listener = container.listen({ port: 0 });
        listener.on('listening', function () {
            done();
        });
    });

    afterEach(function () {
        listener.close();
        received = {};
    });

    it('returns a connection that can be used to send message via default sender', function (done: Function) {
        var container: rhea.Container = rhea.create_container();
        var c: rhea.Connection = container.create_connection(listener.address());
        c.connect();
        var count = 0;
        c.on('accepted', function (context: rhea.EventContext) {
            if (++count === 2) {
                assert.equal(received['a'], 'A');
                assert.equal(received['b'], 'B');
                context.sender!.close();
                context.connection!.close();
                done();
            }
        });
        c.send({ to: 'a', body: 'A' });
        c.send({ to: 'b', body: 'B' });
    });
});

describe('default connect', function () {
    var listener: any;
    var filename: string;

    beforeEach(function (done: Function) {
        var container: rhea.Container = rhea.create_container();
        listener = container.listen({ port: 0 });
        listener.on('listening', function () {
            filename = 'test-connect.json';
            process.env.MESSAGING_CONNECT_FILE = filename;
            fs.writeFile(filename, JSON.stringify({port:listener.address().port}), 'utf8', function () {
                done();
            });
        });
    });

    afterEach(function () {
        if (filename) fs.unlinkSync(filename);
        listener.close();
    });

    it('retrieves necessary config from file', function (done: Function) {
        var client: rhea.Container = rhea.create_container();
        var conn = client.connect();
        var opened = false;
        conn.on('connection_open', function () {
            opened = true;
            conn.close();
        });
        conn.on('connection_close', function () {
            assert(opened);
            done();
        });
    });
});

