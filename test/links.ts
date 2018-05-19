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
import { Server } from "net";
const amqp_types: rhea.ITypes = rhea.types;
const amqp_messaging: rhea.MessageUtil = rhea.message;
const filter: rhea.IFilter = rhea.filter;

describe('link fields', function() {
    var container: rhea.Container, listener: Server;

    beforeEach(function(done: Function) {
        container = rhea.create_container();
        listener = container.listen({port:0});
        listener.on('listening', function() {
            done();
        });
    });

    function open_test(local_role: string, fields: any, verification: Function) {
        var remote_role = local_role === 'sender' ? 'receiver' : 'sender';
        return function(done: Function) {
            container.on(remote_role + '_open', function(context) {
                verification(context[remote_role]);
                done();
            });
            var c: any = container.connect(listener.address());
            c.on(local_role + '_open', function(context: rhea.EventContext) {});
            c['open_' + local_role](fields);
        };
    }

    function open_sender_test(fields: any, verification: Function) {
        return open_test('sender', fields, verification);
    }
    function open_receiver_test(fields: any, verification: Function) {
        return open_test('receiver', fields, verification);
    }

    function close_test(local_role: string, error: rhea.AmqpError, verification: Function) {
        var remote_role = local_role === 'sender' ? 'receiver' : 'sender';
        return function(done: Function) {
            container.on(remote_role + '_close', function(context) {
                verification(context[remote_role]);
                done();
            });
            var c = container.connect(listener.address());
            c.on(local_role + '_open', function(context) {
                context[local_role].local.detach.error = error;
                context[local_role].close();
            });
            c.on(local_role + '_close', function(context) {});
            c['open_' + local_role]();
        };
    }
    function close_test_simple(local_role: string, error: rhea.AmqpError, verification: Function) {
        var remote_role = local_role === 'sender' ? 'receiver' : 'sender';
        return function(done: Function) {
            container.on(remote_role + '_close', function(context: any) {
                verification(context[remote_role]);
                done();
            });
            var c: rhea.Connection = container.connect(listener.address());
            c.on(local_role + '_open', function(context: any) {
                context[local_role].close(error);
            });
            c.on(local_role + '_close', function(context) {});
            c['open_' + local_role]();
        };
    }
    function close_sender_test(error: rhea.AmqpError, verification: Function) {
        return close_test('sender', error, verification);
    }
    function close_receiver_test(error: rhea.AmqpError, verification: Function) {
        return close_test('receiver', error, verification);
    }

    afterEach(function() {
        listener.close();
    });

    var link_types = ['sender', 'receiver'];
    for (var i = 0; i < link_types.length; i++) {
        var t = link_types[i];
        it(t + ' name', open_test(t, {name:'my-link'}, function(link: rhea.link) {
            assert.equal(link.remote.attach.name, 'my-link');
        }));
        it('single offered ' + t + ' capability explicit', open_test(t, {offered_capabilities:'foo'}, function(link: rhea.link) {
            assert.equal(link.remote.attach.offered_capabilities, 'foo');
        }));
        it('single offered ' + t + ' capability aliased', open_test(t, {offered_capabilities:'foo'}, function(link: rhea.link) {
            assert.equal(link.offered_capabilities, 'foo');
        }));
        it('multiple offered ' + t + ' capabilities', open_test(t, {offered_capabilities:['foo', 'bar']}, function(link: rhea.link) {
            assert.equal(link.remote.attach.offered_capabilities.length, 2);
            assert.equal(link.remote.attach.offered_capabilities[0], 'foo');
            assert.equal(link.remote.attach.offered_capabilities[1], 'bar');
        }));
        it('single desired ' + t + ' capability', open_test(t, {desired_capabilities:'foo'}, function(link: rhea.link) {
            assert.equal(link.remote.attach.desired_capabilities, 'foo');
        }));
        it('multiple desired ' + t + ' capabilities', open_test(t, {desired_capabilities:['a', 'b', 'c']}, function(link: rhea.link) {
            assert.equal(link.remote.attach.desired_capabilities.length, 3);
            assert.equal(link.remote.attach.desired_capabilities[0], 'a');
            assert.equal(link.remote.attach.desired_capabilities[1], 'b');
            assert.equal(link.remote.attach.desired_capabilities[2], 'c');
        }));
        it(t + ' properties', open_test(t, {properties:{flavour:'vanilla', scoops:2, cone:true}}, function(link: rhea.link) {
            assert.equal(link.remote.attach.properties.flavour, 'vanilla');
            assert.equal(link.remote.attach.properties.scoops, 2);
            assert.equal(link.remote.attach.properties.cone, true);
        }));
        it('error on ' + t + ' close', close_test(t, {condition:'amqp:link:detach-forced', description:'testing error on close'}, function(link: rhea.link) {
            var error = link.remote.detach.error;
            assert.equal(error.condition, 'amqp:link:detach-forced');
            assert.equal(error.description, 'testing error on close');
        }));
        it('pass error to ' + t + ' close', close_test_simple(t, {condition:'amqp:link:detach-forced', description:'testing error on close'}, function(link: rhea.link) {
            var error = link.remote.detach.error;
            assert.equal(error.condition, 'amqp:link:detach-forced');
            assert.equal(error.description, 'testing error on close');
        }));
    }
    it('source address as simple string', open_receiver_test('my-source', function (link: rhea.link) {
        assert.equal(link.remote.attach.source.address, 'my-source');
    }));
    it('source address aliased', open_receiver_test('my-source', function (link: rhea.link) {
        assert.equal(link.source.address, 'my-source');
    }));
    it('source address as single nested value', open_receiver_test({source:'my-source'}, function (link: rhea.link) {
        assert.equal(link.remote.attach.source.address, 'my-source');
    }));
    it('source as nested object', open_receiver_test(
        {source:{
            address:'my-source',
            durable:1,
            expiry_policy:'session-end',
            timeout:33,
            distribution_mode:'copy',
            filter: filter.selector("colour = 'green'"),
            default_outcome: ((amqp_messaging as any).modified() as any).described(),
            outcomes: ['amqp:list:accepted', 'amqp:list:rejected', 'amqp:list:released', 'amqp:list:modified'],
            capabilities: ['a', 'b', 'c']
        }},
        function (link: rhea.link) {
            assert.equal(link.remote.attach.source.address, 'my-source');
            assert.equal(link.remote.attach.source.durable, 1);
            assert.equal(link.remote.attach.source.expiry_policy, 'session-end');
            assert.equal(link.remote.attach.source.timeout, 33);
            assert.equal(link.remote.attach.source.distribution_mode, 'copy');
            var descriptor = amqp_types.unwrap(link.remote.attach.source.filter['jms-selector'].descriptor);
            assert.equal(descriptor, 0x0000468C00000004);
            assert.equal(link.remote.attach.source.filter['jms-selector'], "colour = 'green'");
            assert.ok(amqp_messaging.is_modified(link.remote.attach.source.default_outcome));
            assert.equal(link.remote.attach.source.outcomes.length, 4);
            assert.equal(link.remote.attach.source.outcomes[0], 'amqp:list:accepted');
            assert.equal(link.remote.attach.source.outcomes[1], 'amqp:list:rejected');
            assert.equal(link.remote.attach.source.outcomes[2], 'amqp:list:released');
            assert.equal(link.remote.attach.source.outcomes[3], 'amqp:list:modified');
            assert.equal(link.remote.attach.source.capabilities.length, 3);
            assert.equal(link.remote.attach.source.capabilities[0], 'a');
            assert.equal(link.remote.attach.source.capabilities[1], 'b');
            assert.equal(link.remote.attach.source.capabilities[2], 'c');
    }));
    it('source with single capability', open_receiver_test(
        {source:{
            address:'my-source',
            capabilities: 'sourceable'
        }},
        function (link: rhea.link) {
            assert.equal(link.remote.attach.source.address, 'my-source');
            assert.equal(link.remote.attach.source.capabilities, 'sourceable');
        }
    ));
    it('dynamic source', open_receiver_test({source:{dynamic:true, dynamic_node_properties:{foo:'bar'}}}, function (link: rhea.link) {
        assert.equal(link.remote.attach.source.dynamic, true);
        assert.equal(link.remote.attach.source.dynamic_node_properties.foo, 'bar');
    }));
    it('dynamic source aliased', open_receiver_test({source:{dynamic:true, dynamic_node_properties:{foo:'bar'}}}, function (link: rhea.link) {
        assert.equal(link.source.dynamic, true);
        assert.equal(link.source.dynamic_node_properties!.foo, 'bar');
    }));
    it('target address as simple string', open_sender_test('my-target', function (link: rhea.link) {
        assert.equal(link.remote.attach.target.address, 'my-target');
    }));
    it('target address aliased', open_sender_test('my-target', function (link: rhea.link) {
        assert.equal(link.target.address, 'my-target');
    }));
    it('target address as single nested value', open_sender_test({target:'my-target'}, function (link: rhea.link) {
        assert.equal(link.remote.attach.target.address, 'my-target');
    }));
    it('target as nested object', open_receiver_test(
        {target:{
            address:'my-target',
            durable:2,
            expiry_policy:'connection-close',
            timeout:33,
            distribution_mode:'copy',
            capabilities: ['d', 'e', 'f']
        }},
        function (link: rhea.link) {
            assert.equal(link.remote.attach.target.address, 'my-target');
            assert.equal(link.remote.attach.target.durable, 2);
            assert.equal(link.remote.attach.target.expiry_policy, 'connection-close');
            assert.equal(link.remote.attach.target.timeout, 33);
            assert.equal(link.remote.attach.target.capabilities.length, 3);
            assert.equal(link.remote.attach.target.capabilities[0], 'd');
            assert.equal(link.remote.attach.target.capabilities[1], 'e');
            assert.equal(link.remote.attach.target.capabilities[2], 'f');
    }));
    it('target with single capability', open_receiver_test(
        {target:{
            address:'my-target',
            capabilities: 'targetable'
        }},
        function (link: rhea.link) {
            assert.equal(link.remote.attach.target.address, 'my-target');
            assert.equal(link.remote.attach.target.capabilities, 'targetable');
        }
    ));
    it('dynamic target', open_receiver_test({target:{dynamic:true, dynamic_node_properties:{foo:'bar'}}}, function (link: rhea.link) {
        assert.equal(link.remote.attach.target.dynamic, true);
        assert.equal(link.remote.attach.target.dynamic_node_properties.foo, 'bar');
    }));
});

var roles: any = {'sender':'receiver', 'receiver':'sender'};
for (var local_role in roles) {
    describe(local_role + ' events', function() {
        var listener: Server;

        beforeEach(function(done: Function) {
            var container = rhea.create_container();
            container.on(roles[local_role] + '_open', function(context) {
                var link = context[roles[local_role]];
                link.local.attach.offered_capabilities = link.remote.attach.desired_capabilities;
            });
            listener = container.listen({port:0});
            listener.on('listening', function() {
                done();
            });
        });

        afterEach(function() {
            listener.close();
        });

        it('dispatches events to correct handlers', function(done: Function) {
            var latch: any = {
                count: 3,
                decrement: function() {
                    if (--this.count == 0) done();
                }
            };
            var container: rhea.Container = rhea.create_container();

            var c: rhea.Connection = container.connect(listener.address());
            c.on(local_role + '_open', function (context) {
                assert.equal(context[local_role].remote.attach.offered_capabilities, 'one');
                latch.decrement();
                context[local_role].close();
            });
            c['open_' + local_role]({desired_capabilities:'one'});
            var s2 = c['open_' + local_role]({desired_capabilities:'two'});
            s2.on(local_role + '_open', function (context: any) {
                assert.equal(context[local_role].remote.attach.offered_capabilities, 'two');
                latch.decrement();
                context.connection.close();
            });
            container.connect(listener.address())['open_' + local_role]({desired_capabilities:'three'});
            //third link has no handler defined at either link or connection level, so will default to container level handler:
            container.on(local_role + '_open', function(context) {
                assert.equal(context[local_role].remote.attach.offered_capabilities, 'three');
                latch.decrement();
                context.connection.close();
            });
        });
    });
    describe(local_role + ' error handling', function() {
        var container: any, listener: any;
        var remote_role: string;

        beforeEach(function(done: Function) {
            remote_role = roles[local_role];
            container = rhea.create_container();
            listener = container.listen({port:0});
            listener.on('listening', function() {
                done();
            });
        });

        afterEach(function() {
            listener.close();
        });

        it('error and close handled', function (done: Function) {
            var error_handler_called: boolean;
            var close_handler_called: boolean;
            container.on(remote_role + '_open', function(context: any) {
                context[remote_role].close({condition:'amqp:link:detach-forced', description:'testing error on close'});
            });
            container.on('connection_close', function(contex: rhea.EventContext) {
                assert.equal(error_handler_called, true);
                assert.equal(close_handler_called, true);
                done();
            });
            var c: rhea.Connection = rhea.create_container().connect(listener.address());
            c.on(local_role + '_error', function(context) {
                error_handler_called = true;
                var error = context[local_role].error;
                assert.equal(error.condition, 'amqp:link:detach-forced');
                assert.equal(error.description, 'testing error on close');
            });
            c.on(local_role + '_close', function(context) {
                close_handler_called = true;
                var error = context[local_role].error;
                assert.equal(error.condition, 'amqp:link:detach-forced');
                assert.equal(error.description, 'testing error on close');
                c.close();
            });
            c['open_' + local_role]('foo');
        });
        it('error handled', function (done: Function) {
            var error_handler_called: boolean;
            container.on(remote_role + '_open', function(context: any) {
                context[remote_role].close({condition:'amqp:link:detach-forced', description:'testing error on close'});
            });
            container.on('connection_close', function(context: rhea.EventContext) {
                assert.equal(error_handler_called, true);
                done();
            });
            var c = rhea.create_container().connect(listener.address());
            c.on(local_role + '_error', function(context: any) {
                error_handler_called = true;
                var error = context[local_role].error;
                assert.equal(error.condition, 'amqp:link:detach-forced');
                assert.equal(error.description, 'testing error on close');
                c.close();
            });
            c['open_' + local_role]();
        });
        it('unhandled error', function (done: Function) {
            var error_handler_called;
            container.on(remote_role + '_open', function(context: any) {
                context[remote_role].close({condition:'amqp:link:detach-forced', description:'testing error on close'});
            });
            container.on('connection_close', function(context: rhea.EventContext) {
                done();
            });
            var container2 = rhea.create_container();
            var c = container2.connect(listener.address());
            container2.on('error', function (error) {
                assert.equal(error.condition, 'amqp:link:detach-forced');
                assert.equal(error.description, 'testing error on close');
                c.close();
            });
            c['open_' + local_role]();
        });
    });
}

describe('settlement modes', function() {
    var server: rhea.Container, client: rhea.Container, listener: Server;

    beforeEach(function(done: Function) {
        server = rhea.create_container();
        client = rhea.create_container();
        listener = server.listen({port:0});
        listener.on('listening', function() {
            done();
        });

    });

    afterEach(function() {
        listener.close();
    });

    it('sender sends unsettled', function(done: Function) {
        server.on('receiver_open', function(context) {
            assert.equal(context.receiver.snd_settle_mode, 0);
        });
        server.on('message', function(context) {
            assert.equal(context.message.body, 'settle-me');
            assert.equal(context.delivery.remote_settled, false);
        });
        client.on('settled', function (context) {
            context.connection.close();
        });
        client.once('sendable', function (context) {
            context.sender.send({body:'settle-me'});
        });
        client.on('connection_close', function (context) {
            done();
        });
        client.connect(listener.address()).attach_sender({snd_settle_mode:0});
    });
    it('sender sends settled', function(done: Function) {
        server.on('receiver_open', function(context) {
            assert.equal(context.receiver.snd_settle_mode, 1);
        });
        server.on('message', function(context) {
            assert.equal(context.message.body, 'already-settled');
            assert.equal(context.delivery.remote_settled, true);
            context.connection.close();
        });
        client.once('sendable', function (context) {
            context.sender.send({body:'already-settled'});
        });
        client.on('connection_close', function (context) {
            done();
        });
        client.connect(listener.address()).attach_sender({snd_settle_mode:1});
    });
    it('receiver requests send unsettled', function(done: Function) {
        server.on('sender_open', function(context) {
            assert.equal(context.sender.snd_settle_mode, 0);
            context.sender.local.attach.snd_settle_mode = context.sender.snd_settle_mode;
        });
        server.on('settled', function (context) {
            context.connection.close();
        });
        server.once('sendable', function (context) {
            context.sender.send({body:'settle-me'});
        });
        client.on('message', function(context) {
            assert.equal(context.message.body, 'settle-me');
            assert.equal(context.delivery.remote_settled, false);
        });
        client.on('connection_close', function (context) {
            done();
        });
        client.connect(listener.address()).attach_receiver({snd_settle_mode:0});
    });
    it('receiver requests send settled', function(done: Function) {
        server.on('sender_open', function(context) {
            assert.equal(context.sender.snd_settle_mode, 1);
            context.sender.local.attach.snd_settle_mode = context.sender.snd_settle_mode;
        });
        server.once('sendable', function (context) {
            context.sender.send({body:'already-settled'});
        });
        client.on('message', function(context) {
            assert.equal(context.message.body, 'already-settled');
            assert.equal(context.delivery.remote_settled, true);
            context.connection.close();
        });
        client.on('connection_close', function (context) {
            done();
        });
        client.connect(listener.address()).attach_receiver({snd_settle_mode:1});
    });
    it('receiver settles first', function(done: Function) {
        server.on('sender_open', function(context) {
            assert.equal(context.sender.rcv_settle_mode, 0);
        });
        server.once('sendable', function (context) {
            context.sender.send({body:'settle-me'});
        });
        server.once('accepted', function (context) {
            assert.equal(context.delivery.remote_settled, true);
            context.connection.close();
        });
        client.on('message', function(context) {
            assert.equal(context.message.body, 'settle-me');
            assert.equal(context.delivery.remote_settled, false);
        });
        client.on('connection_close', function (context) {
            done();
        });
        client.connect(listener.address()).attach_receiver({rcv_settle_mode:0});
    });
    it('receiver settles second', function(done: Function) {
        server.on('sender_open', function(context) {
            assert.equal(context.sender.rcv_settle_mode, 1);
        });
        server.once('sendable', function (context) {
            context.sender.send({body:'settle-me'});
        });
        server.once('accepted', function (context) {
            assert.equal(context.delivery.remote_settled, false);
            context.delivery.update(true);
        });
        client.on('message', function(context) {
            assert.equal(context.message.body, 'settle-me');
            assert.equal(context.delivery.remote_settled, false);
        });
        client.on('settled', function (context) {
            assert.equal(context.delivery.remote_settled, true);
            context.connection.close();
        });
        client.on('connection_close', function (context) {
            done();
        });
        client.connect(listener.address()).attach_receiver({rcv_settle_mode:1});
    });
});

describe('preset sender options', function() {
    var container: rhea.Container, listener: Server;

    beforeEach(function(done: Function) {
        container = rhea.create_container();
        listener = container.listen({port:0});
        listener.on('listening', function() {
            done();
        });
    });

    afterEach(function() {
        listener.close();
    });

    function connection_options_test(default_options: any, verification: any, open_options?: any) {
        return function(done: Function) {
            container.on('receiver_open', function(context) {
                verification(context.receiver);
                done();
            });
            var c = container.connect(listener.address());
            c.options.sender_options = default_options;
            c.on('sender_open', function(context) {});
            c.open_sender(open_options);
        };
    }

    it('properties', connection_options_test({properties:{'foo':'bar'}}, function(receiver: rhea.Receiver) {
        assert.equal(receiver.properties.foo, 'bar');
    }));

    it('merged properties', connection_options_test({properties:{'foo':'bar'}}, function(receiver: rhea.Receiver) {
        assert.equal(receiver.properties.foo, 'bar');
        assert.equal(receiver.properties.fursty, 'ferret');
    }, {properties:{'fursty':'ferret'}}));

    it('offered capabilities', connection_options_test({offered_capabilities:['xyz']}, function(receiver: rhea.Receiver) {
        assert.equal(receiver.offered_capabilities.length, 1);
        assert.equal(receiver.offered_capabilities[0], 'xyz');
    }));

    it('desired capabilities', connection_options_test({desired_capabilities:['penguin']}, function(receiver: rhea.Receiver) {
        assert.equal(receiver.desired_capabilities.length, 1);
        assert.equal(receiver.desired_capabilities[0], 'penguin');
    }));

    it('does not modify default options', function(done: Function) {
        var count: number = 0;
        var name: string;
        container.on('receiver_open', function(context: rhea.EventContext) {
            if (++count === 1) {
                assert.equal(context.receiver!.offered_capabilities.length, 1);
                assert.equal(context.receiver!.offered_capabilities[0], 'xyz');
                name = context.receiver!.name;
            } else {
                assert.notEqual(context.receiver!.name, name);
                assert.notEqual(context.receiver!.target, 'foo');
                done();
            }
        });
        var c = container.connect(listener.address());
        c.options.sender_options = {offered_capabilities:['xyz']};
        c.on('sender_open', function(context) {});
        c.open_sender({target:'foo'}).on('sender_open', function () {
            c.open_sender();
        });
    });
});

describe('preset receiver options', function() {
    var container: rhea.Container, listener: Server;

    beforeEach(function(done: Function) {
        container = rhea.create_container();
        listener = container.listen({port:0});
        listener.on('listening', function() {
            done();
        });
    });

    afterEach(function() {
        listener.close();
    });

    function connection_options_test(default_options: any, verification: any, open_options?: any) {
        return function(done: Function) {
            container.on('sender_open', function(context) {
                verification(context.sender);
                done();
            });
            var c: rhea.Connection = container.connect(listener.address());
            c.options.receiver_options = default_options;
            c.on('receiver_open', function(context :rhea.EventContext) {});
            c.open_receiver(open_options);
        };
    }

    it('properties', connection_options_test({properties:{'foo':'bar'}}, function(sender: rhea.Sender) {
        assert.equal(sender.properties.foo, 'bar');
    }));

    it('merged properties', connection_options_test({properties:{'bing':'bong'}}, function(sender: rhea.Sender) {
        assert.equal(sender.properties.bing, 'bong');
        assert.equal(sender.properties.black, 'sheep');
    }, {properties:{'black':'sheep'}}));

    it('offered capabilities', connection_options_test({offered_capabilities:['xyz']}, function(sender: rhea.Sender) {
        assert.equal(sender.offered_capabilities.length, 1);
        assert.equal(sender.offered_capabilities[0], 'xyz');
    }));

    it('desired capabilities', connection_options_test({desired_capabilities:['penguin']}, function(sender: rhea.Sender) {
        assert.equal(sender.desired_capabilities.length, 1);
        assert.equal(sender.desired_capabilities[0], 'penguin');
    }));

    it('max-message-size', connection_options_test({max_message_size:2048}, function(sender: rhea.Sender) {
        assert.equal(sender.max_message_size, 2048);
    }));

});

describe('miscellaneous', function() {
    var server: rhea.Container, client: rhea.Container, listener: Server;

    beforeEach(function(done: Function) {
        server = rhea.create_container();
        client = rhea.create_container();
        listener = server.listen({port:0});
        listener.on('listening', function() {
            done();
        });

    });

    afterEach(function() {
        listener.close();
    });

    it('receive if local closed but remote open', function(done: Function) {
        server.on('sender_open', function(context: rhea.EventContext) {
            context.sender!.send({subject:'one'} as rhea.Message);
        });
        var msgs = ['two', 'three', 'four', 'five'];
        server.once('settled', function (context: rhea.EventContext) {
            msgs.forEach(function (m) {
                context.sender!.send({subject:m} as rhea.Message);
            });
        });
        function verify_after_close (context: rhea.EventContext) {
            assert(msgs.length);
            var expected = msgs.shift();
            assert.equal(context.message!.subject, expected);
            if (msgs.length === 0) {
                context.connection.close();
            }
        }
        client.once('message', function (context: rhea.EventContext) {
            assert.equal(context.message!.subject, 'one');
            client.on('message', verify_after_close);
            context.receiver!.close();
        });
        client.on('connection_close', function (context: rhea.EventContext) {
            assert.equal(msgs.length, 0);
            done();
        });
        client.connect(listener.address()).open_receiver();
    });
});
