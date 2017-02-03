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
var rhea = require('../lib/container.js');
var amqp_types = require('../lib/types.js');
var amqp_message = require('../lib/message.js');
var rhea_util = require('../lib/util.js');

describe('message content', function() {
    var container, sender, listener;

    beforeEach(function(done) {
        container = rhea.create_container();
        listener = container.listen({port:0});
        listener.on('listening', function() {
            sender = container.connect(listener.address()).attach_sender();
            done();
        });

    });

    function transfer_test(message, verification) {
        return function(done) {
            container.on('message', function(context) {
                verification(context.message);
                done();
            });
            sender.send(message);
        };
    }

    afterEach(function() {
        listener.close();
    });

    it('sends and receives string body', transfer_test({body:'hello world!'}, function(message) {
        assert.equal(message.body, 'hello world!');
    }));
    it('sends and receives binary body', transfer_test({body:amqp_types.wrap_binary(new Buffer('hello world!'))}, function(message) {
        assert.equal(message.body.toString(), 'hello world!');
    }));
    it('sends and receives body as data section', transfer_test({body:amqp_message.data_section(new Buffer('hello world!'))}, function(message) {
        assert.equal(message.body.typecode, 0x75);
        assert.equal(message.body.content.toString(), 'hello world!');
    }));
    it('sends and receives body as sequence section', transfer_test({body:amqp_message.sequence_section(['hello', 1, 'world!'])}, function(message) {
        assert.equal(message.body.typecode, 0x76);
        assert.equal(message.body.content[0], 'hello');
        assert.equal(message.body.content[1], 1);
        assert.equal(message.body.content[2], 'world!');
    }));
    it('sends and receives subject', transfer_test({properties:{subject:'my-subject'}}, function(message) {
        assert.equal(message.properties.subject, 'my-subject');
    }));
    it('sends and receives message-id', transfer_test({properties:{message_id:'my-id'}}, function(message) {
        assert.equal(message.properties.message_id, 'my-id');
    }));
    it('sends and receives string property', transfer_test({application_properties:{colour:'red'}}, function(message) {
        assert.equal(message.application_properties.colour, 'red');
    }));
    it('sends and receives int property', transfer_test({application_properties:{age:101}}, function(message) {
        assert.equal(message.application_properties.age, 101);
    }));
    it('sends and receives float property', transfer_test({application_properties:{pi:3.14}}, function(message) {
        assert.equal(message.application_properties.pi, 3.14);
    }));
    it('sends and receives long property', transfer_test({application_properties:{big:1467407965596}}, function(message) {
        assert.equal(message.application_properties.big, 1467407965596);
    }));
    it('sends and receives ulong property', transfer_test({application_properties:{bigneg:-1234567898765}}, function(message) {
        assert.equal(message.application_properties.bigneg, -1234567898765);
    }));
    it('sends and receives char property', transfer_test({application_properties:{'x':amqp_types.wrap_char(0x2603)}}, function(message) {
        assert.equal(message.application_properties.x, 0x2603);
    }));
    var test_uuid = rhea_util.uuid4();
    it('sends and receives a uuid property', transfer_test({application_properties:{'x':amqp_types.wrap_uuid(test_uuid)}}, function(message) {
        assert.equal(rhea_util.uuid_to_string(message.application_properties.x), rhea_util.uuid_to_string(test_uuid));
    }));
    it('sends and receives string message annotation', transfer_test({message_annotations:{colour:'blue'}}, function(message) {
        assert.equal(message.message_annotations.colour, 'blue');
    }));
    it('sends and receives int delivery annotation', transfer_test({delivery_annotations:{count:8765}}, function(message) {
        assert.equal(message.delivery_annotations.count, 8765);
    }));
    it('sends and receives body of 1k', transfer_test({body:new Array(1024+1).join('x')}, function(message) {
        assert.equal(message.body, new Array(1024+1).join('x'));
    }));
    it('sends and receives body of 5k', transfer_test({body:new Array(1024*5+1).join('y')}, function(message) {
        assert.equal(message.body, new Array(1024*5+1).join('y'));
    }));
    it('sends and receives body of 50k', transfer_test({body:new Array(1024*50+1).join('z')}, function(message) {
        assert.equal(message.body, new Array(1024*50+1).join('z'));
    }));
    it('sends and receives map body', transfer_test({body:{colour:'green',age:8,happy:true, sad:false}}, function(message) {
        assert.equal(message.body.colour, 'green');
        assert.equal(message.body.age, 8);
        assert.equal(message.body.happy, true);
        assert.equal(message.body.sad, false);
        assert.equal(message.body.indifferent, undefined);
    }));
    it('sends and receives map with doubles', transfer_test({body:{west:amqp_types.wrap_double(4.734), north:amqp_types.wrap_double(56.0023),
                                                                     }}, function(message) {

        assert.equal(message.body.north, 56.0023);
        assert.equal(message.body.west, 4.734);
    }));
    it('sends and receives map with floats', transfer_test({body:{half:amqp_types.wrap_float(0.5), quarter:amqp_types.wrap_double(0.25),
                                                                     }}, function(message) {

        assert.equal(message.body.half, 0.5);
        assert.equal(message.body.quarter, 0.25);
    }));
    it('sends and receives map with ulongs', transfer_test({body:{age:amqp_types.wrap_ulong(888), max:amqp_types.wrap_ulong(9007199254740992),
                                                                     }}, function(message) {
        assert.equal(message.body.max, 9007199254740992);
        assert.equal(message.body.age, 888);
    }));
    it('sends and receives map with longs', transfer_test({body:{one:amqp_types.wrap_long(1),
                                                                     negative_one:amqp_types.wrap_long(-1),
                                                                     positive:amqp_types.wrap_long(1000),
                                                                     negative:amqp_types.wrap_long(-1000),
                                                                     large:amqp_types.wrap_long(1000000000),
                                                                     large_negative:amqp_types.wrap_long(-1000000000),
                                                                     awkward:amqp_types.wrap_long(1467407965596),
                                                                     max:amqp_types.wrap_long(9007199254740992),
                                                                     min:amqp_types.wrap_long(-9007199254740992)
                                                                    }}, function(message) {
        assert.equal(message.body.one, 1);
        assert.equal(message.body.negative_one, -1);
        assert.equal(message.body.positive, 1000);
        assert.equal(message.body.negative, -1000);
        assert.equal(message.body.large, 1000000000);
        assert.equal(message.body.large_negative, -1000000000);
        assert.equal(message.body.awkward, 1467407965596);
        assert.equal(message.body.max, 9007199254740992);
        assert.equal(message.body.min, -9007199254740992);
    }));
    it('sends and receives map with ulongs/longs as buffers', transfer_test({body:{too_big:new amqp_types.Ulong(new Buffer([0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF])),
                                                                                   too_small:new amqp_types.Long(new Buffer([0xFF,0x00,0x00,0x00,0x00,0x00,0x00,0x00]))
                                                                     }}, function(message) {
        assert.equal(message.body.too_big.length, 8);
        for (var i = 0; i < 8; i++) {
            assert.equal(message.body.too_big[i], 0xFF);
        }
        assert.equal(message.body.too_small.length, 8);
        for (var i = 0; i < 8; i++) {
            if (i === 0) {
                assert.equal(message.body.too_small[i], 0xFF);
            } else {
                assert.equal(message.body.too_small[i], 0x00);
            }
        }

    }));
    it('get header and properties directly', transfer_test({properties:{
        message_id:'my-id',
        user_id:'my-user',
        to:'my-to',
        subject:'my-subject',
        reply_to:'my-reply-to',
        correlation_id:'correlate-me',
        content_type:'text',
        content_encoding:'ascii',
        absolute_expiry_time:123456789,
        creation_time:987654321,
        group_id:'my-group',
        group_sequence:77,
        reply_to_group_id:'still-my-group'
    }, header:{
        durable:true,
        priority:3,
        ttl:123456789,
        first_acquirer:false,
        delivery_count:8
    }}, function(message) {
        assert.equal(message.message_id, 'my-id');
        assert.equal(message.user_id, 'my-user');
        assert.equal(message.to, 'my-to');
        assert.equal(message.subject, 'my-subject');
        assert.equal(message.reply_to, 'my-reply-to');
        assert.equal(message.correlation_id, 'correlate-me');
        assert.equal(message.content_type, 'text');
        assert.equal(message.content_encoding, 'ascii');
        assert.equal(message.absolute_expiry_time, 123456789);
        assert.equal(message.creation_time, 987654321);
        assert.equal(message.group_id, 'my-group');
        assert.equal(message.group_sequence, 77);
        assert.equal(message.reply_to_group_id, 'still-my-group');
        assert.equal(message.durable, true);
        assert.equal(message.priority, 3);
        assert.equal(message.ttl, 123456789);
        assert.equal(message.first_acquirer, false);
        assert.equal(message.delivery_count, 8);
    }));
    it('set header and properties directly', transfer_test({
        message_id:'my-id',
        user_id:'my-user',
        to:'my-to',
        subject:'my-subject',
        reply_to:'my-reply-to',
        correlation_id:'correlate-me',
        content_type:'text',
        content_encoding:'ascii',
        absolute_expiry_time:123456789,
        creation_time:987654321,
        group_id:'my-group',
        group_sequence:77,
        reply_to_group_id:'still-my-group',
        durable:true,
        priority:3,
        ttl:123456789,
        first_acquirer:false,
        delivery_count:8
    }, function(message) {
        assert.equal(message.properties.message_id, 'my-id');
        assert.equal(message.properties.user_id, 'my-user');
        assert.equal(message.properties.to, 'my-to');
        assert.equal(message.properties.subject, 'my-subject');
        assert.equal(message.properties.reply_to, 'my-reply-to');
        assert.equal(message.properties.correlation_id, 'correlate-me');
        assert.equal(message.properties.content_type, 'text');
        assert.equal(message.properties.content_encoding, 'ascii');
        assert.equal(message.properties.absolute_expiry_time, 123456789);
        assert.equal(message.properties.creation_time, 987654321);
        assert.equal(message.properties.group_id, 'my-group');
        assert.equal(message.properties.group_sequence, 77);
        assert.equal(message.properties.reply_to_group_id, 'still-my-group');
        assert.equal(message.header.durable, true);
        assert.equal(message.header.priority, 3);
        assert.equal(message.header.ttl, 123456789);
        assert.equal(message.header.first_acquirer, false);
        assert.equal(message.header.delivery_count, 8);
    }));
    it('get application property directly', transfer_test({application_properties:{colour:'red'}}, function(message) {
        assert.equal(message.colour, 'red');
    }));
    it('set application property directly', transfer_test({colour:'red'}, function(message) {
        assert.equal(message.application_properties.colour, 'red');
    }));
    it('test undefined properties and headers directly', transfer_test({body:'hello world!'}, function(message) {
        assert.equal(message.body, 'hello world!');
        assert.equal(message.message_id, undefined);
        assert.equal(message.user_id, undefined);
        assert.equal(message.to, undefined);
        assert.equal(message.subject, undefined);
        assert.equal(message.reply_to, undefined);
        assert.equal(message.correlation_id, undefined);
        assert.equal(message.content_type, undefined);
        assert.equal(message.content_encoding, undefined);
        assert.equal(message.absolute_expiry_time, undefined);
        assert.equal(message.creation_time, undefined);
        assert.equal(message.group_id, undefined);
        assert.equal(message.group_sequence, undefined);
        assert.equal(message.reply_to_group_id, undefined);
        assert.equal(message.durable, undefined);
        assert.equal(message.priority, undefined);
        assert.equal(message.ttl, undefined);
        assert.equal(message.first_acquirer, undefined);
        assert.equal(message.delivery_count, undefined);
    }));
    it('message has a toString', transfer_test({message_id:'my-id', body:'hello world!'}, function(message) {
        assert.equal(message.toString(), '{"message_id":"my-id","body":"hello world!"}');
    }));
});

describe('acknowledgement', function() {
    var server, client, listener;
    var outcome;

    beforeEach(function(done) {
        outcome = {};
        server = rhea.create_container();
        server.on('accepted', function (context) {
            outcome.state = 'accepted';
        });
        server.on('released', function (context) {
            outcome.state = 'released';
            outcome.delivery_failed = context.delivery.remote_state.delivery_failed;
            outcome.undeliverable_here = context.delivery.remote_state.undeliverable_here;
        });
        server.on('rejected', function (context) {
            outcome.state = 'rejected';
            outcome.error = context.delivery.remote_state.error;
        });
        server.on('settled', function (context) {
            context.connection.close();
        });
        client = rhea.create_container();
        listener = server.listen({port:0});
        listener.on('listening', function() {
            done();
        });

    });

    afterEach(function() {
        listener.close();
    });

    it('auto-accept', function(done) {
        server.once('sendable', function (context) {
            context.sender.send({body:'accept-me'});
        });
        client.on('message', function(context) {
            assert.equal(context.message.body, 'accept-me');
        });
        client.on('connection_close', function (context) {
            assert.equal(outcome.state, 'accepted');
            done();
        });
        client.connect(listener.address()).attach_receiver();
    });
    it('explicit accept', function(done) {
        server.once('sendable', function (context) {
            context.sender.send({body:'accept-me'});
        });
        client.on('message', function(context) {
            assert.equal(context.message.body, 'accept-me');
            context.delivery.accept();
        });
        client.on('connection_close', function (context) {
            assert.equal(outcome.state, 'accepted');
            done();
        });
        client.connect(listener.address()).attach_receiver({autoaccept: false});
    });
    it('explicit release', function(done) {
        server.once('sendable', function (context) {
            context.sender.send({body:'release-me'});
        });
        client.on('message', function(context) {
            assert.equal(context.message.body, 'release-me');
            context.delivery.release();
        });
        client.on('connection_close', function (context) {
            assert.equal(outcome.state, 'released');
            assert.equal(outcome.delivery_failed, undefined);
            assert.equal(outcome.undeliverable_here, undefined);
            done();
        });
        client.connect(listener.address()).attach_receiver({autoaccept: false});
    });
    it('explicit reject', function(done) {
        server.once('sendable', function (context) {
            context.sender.send({body:'reject-me'});
        });
        client.on('message', function(context) {
            assert.equal(context.message.body, 'reject-me');
            context.delivery.reject({condition:'rhea:oops:string',description:'something bad occurred'});
        });
        client.on('connection_close', function (context) {
            assert.equal(outcome.state, 'rejected');
            assert.equal(outcome.error.condition, 'rhea:oops:string');
            assert.equal(outcome.modified, undefined);
            done();
        });
        client.connect(listener.address()).attach_receiver({autoaccept: false});
    });
    it('explicit modify', function(done) {
        server.options.treat_modified_as_released = false;
        server.on('modified', function (context) {
            assert.equal(outcome.state, undefined);
            outcome.state = 'modified';
            outcome.delivery_failed = context.delivery.remote_state.delivery_failed;
            outcome.undeliverable_here = context.delivery.remote_state.undeliverable_here;
        });
        server.once('sendable', function (context) {
            context.sender.send({body:'modify-me'});
        });
        client.on('message', function(context) {
            assert.equal(context.message.body, 'modify-me');
            context.delivery.modified({delivery_failed:true, undeliverable_here: true});
        });
        client.on('connection_close', function (context) {
            assert.equal(outcome.state, 'modified');
            assert.equal(outcome.delivery_failed, true);
            assert.equal(outcome.undeliverable_here, true);
            done();
        });
        client.connect(listener.address()).attach_receiver({autoaccept: false});
    });
    it('modified as released', function(done) {
        server.once('sendable', function (context) {
            context.sender.send({body:'try-again'});
        });
        client.on('message', function(context) {
            assert.equal(context.message.body, 'try-again');
            context.delivery.release({delivery_failed:true, undeliverable_here: true});
        });
        client.on('connection_close', function (context) {
            assert.equal(outcome.state, 'released');
            assert.equal(outcome.delivery_failed, true);
            assert.equal(outcome.undeliverable_here, true);
            done();
        });
        client.connect(listener.address()).attach_receiver({autoaccept: false});
    });
});
