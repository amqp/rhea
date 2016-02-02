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
var amqp_types = require('rhea/lib/types.js');

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
    it('sends and receives map body', transfer_test({body:{colour:'green',age:8}}, function(message) {
        assert.equal(message.body.colour, 'green');
        assert.equal(message.body.age, 8);
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
                                                                     max:amqp_types.wrap_long(9007199254740992),
                                                                     min:amqp_types.wrap_long(-9007199254740992)
                                                                    }}, function(message) {
        assert.equal(message.body.one, 1);
        assert.equal(message.body.negative_one, -1);
        assert.equal(message.body.positive, 1000);
        assert.equal(message.body.negative, -1000);
        assert.equal(message.body.large, 1000000000);
        assert.equal(message.body.large_negative, -1000000000);
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

});
