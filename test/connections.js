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

describe('connection fields', function() {
    var container, listener;

    beforeEach(function(done) {
        container = rhea.create_container();
        listener = container.listen({port:0});
        listener.on('listening', function() {
            done();
        });
    });

    function open_test(fields, verification) {
        return function(done) {
            container.on('connection_open', function(context) {
                verification(context.connection);
                done();
            });
            fields.port = listener.address().port;
            container.connect(fields).on('connection_open', function(context) {});
        };
    }

    function close_test(error, verification) {
        return function(done) {
            container.on('connection_close', function(context) {
                verification(context.connection);
                done();
            });
            var c = container.connect(listener.address());
            c.on('connection_open', function(context) {
                context.connection.local.close.error = error;
                context.connection.close();
            });
            c.on('connection_close', function(context) {});
        };
    }

    afterEach(function() {
        listener.close();
    });

    it('single offered capability', open_test({offered_capabilities:'foo'}, function(connection) {
        assert.equal(connection.remote.open.offered_capabilities, 'foo');
    }));
    it('multiple offered capabilities', open_test({offered_capabilities:['foo', 'bar']}, function(connection) {
        assert.equal(connection.remote.open.offered_capabilities.length, 2);
        assert.equal(connection.remote.open.offered_capabilities[0], 'foo');
        assert.equal(connection.remote.open.offered_capabilities[1], 'bar');
    }));
    it('single desired capability', open_test({desired_capabilities:'foo'}, function(connection) {
        assert.equal(connection.remote.open.desired_capabilities, 'foo');
    }));
    it('multiple desired capabilities', open_test({desired_capabilities:['a', 'b', 'c']}, function(connection) {
        assert.equal(connection.remote.open.desired_capabilities.length, 3);
        assert.equal(connection.remote.open.desired_capabilities[0], 'a');
        assert.equal(connection.remote.open.desired_capabilities[1], 'b');
        assert.equal(connection.remote.open.desired_capabilities[2], 'c');
    }));
    it('hostname', open_test({hostname:'my-virtual-host'}, function(connection) {
        assert.equal(connection.remote.open.hostname, 'my-virtual-host');
    }));
    it('container_id', open_test({container_id:'this-is-me'}, function(connection) {
        assert.equal(connection.remote.open.container_id, 'this-is-me');
    }));
    it('max frame size', open_test({max_frame_size:5432}, function(connection) {
        assert.equal(connection.remote.open.max_frame_size, 5432);
    }));
    it('channel max', open_test({channel_max:10}, function(connection) {
        assert.equal(connection.remote.open.channel_max, 10);
    }));
    it('idle time out', open_test({idle_time_out:1000}, function(connection) {
        assert.equal(connection.remote.open.idle_time_out, 1000);
    }));
    it('properties', open_test({properties:{flavour:'vanilla', scoops:2, cone:true}}, function(connection) {
        assert.equal(connection.remote.open.properties.flavour, 'vanilla');
        assert.equal(connection.remote.open.properties.scoops, 2);
        assert.equal(connection.remote.open.properties.cone, true);
    }));
    it('error on close', close_test({condition:'amqp:connection:forced', description:'testing error on close'}, function(connection) {
        var error = connection.remote.close.error;
        assert.equal(error.condition, 'amqp:connection:forced');
        assert.equal(error.description, 'testing error on close');
    }));
});

describe('connection events', function() {
    var listener;

    beforeEach(function(done) {
        var container = rhea.create_container();
        container.on('connection_open', function(context) {
            var conn = context.connection;
            conn.local.open.offered_capabilities = conn.remote.open.desired_capabilities;
        });
        listener = container.listen({port:0});
        listener.on('listening', function() {
            done();
        });
    });

    afterEach(function() {
        listener.close();
    });

    it('dispatches events to correct handlers', function(done) {
        var latch = {
            count: 3,
            decrement: function() {
                if (--this.count == 0) done();
            }
        };
        var container = rhea.create_container();

        var c1 = container.connect({port: listener.address().port, desired_capabilities:'one'});
        c1.on('connection_open', function (context) {
            assert.equal(context.connection.remote.open.offered_capabilities, 'one');
            latch.decrement();
            context.connection.close();
        });
        var c2 = container.connect({port: listener.address().port, desired_capabilities:'two'});
        c2.on('connection_open', function (context) {
            assert.equal(context.connection.remote.open.offered_capabilities, 'two');
            latch.decrement();
            context.connection.close();
        });
        var c3 = container.connect({port: listener.address().port, desired_capabilities:'three'});
        //third connection has no handler defined, so will default to container level handler:
        container.on('connection_open', function(context) {
            assert.equal(context.connection.remote.open.offered_capabilities, 'three');
            latch.decrement();
            context.connection.close();
        });
    });
});

describe('container id', function() {
    var listener;
    var client_container_name;

    beforeEach(function(done) {
        var container = rhea.create_container({id:'my-server-container'});
        container.on('connection_open', function(context) {
            client_container_name = context.connection.remote.open.container_id;
        });
        listener = container.listen({port:0});
        listener.on('listening', function() {
            done();
        });
    });

    afterEach(function() {
        listener.close();
    });

    it('correctly sets desired container id', function(done) {
        var container = rhea.create_container({id:'my-client-container'});

        var c1 = container.connect(listener.address());
        c1.on('connection_open', function (context) {
            assert.equal(context.connection.remote.open.container_id, 'my-server-container');
            assert.equal(client_container_name, 'my-client-container');
            context.connection.close();
            done();
        });
    });
});

describe('connection send', function() {
    var listener;
    var received = {};

    beforeEach(function(done) {
        var container = rhea.create_container();
        container.on('message', function(context) {
            received[context.message.properties.to] = context.message.body;
        });
        listener = container.listen({port:0});
        listener.on('listening', function() {
            done();
        });
    });

    afterEach(function() {
        listener.close();
        received = {};
    });

    it('sends message via default sender', function(done) {
        var container = rhea.create_container();

        var c = container.connect(listener.address());
        var count = 0;
        c.on('accepted', function (context) {
            if (++count === 2) {
                assert.equal(received['a'], 'A');
                assert.equal(received['b'], 'B');
                context.sender.close();
                context.connection.close();
                done();
            }
        });
        c.send({properties:{to:'a'},body:'A'});
        c.send({properties:{to:'b'},body:'B'});
    });
});
