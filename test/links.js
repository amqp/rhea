/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
 */
'use strict';

var assert = require('assert');
var rhea = require('rhea');

describe('link fields', function() {
    var container, listener;

    beforeEach(function(done) {
        container = rhea.create_container();
        listener = container.listen({port:0});
        listener.on('listening', function() {
            done();
        });
    });

    function open_test(local_role, fields, verification) {
        var remote_role = local_role === 'sender' ? 'receiver' : 'sender';
        return function(done) {
            container.on(remote_role + '_open', function(context) {
                verification(context[remote_role]);
                done();
            });
            var c = container.connect(listener.address());
            c.on(local_role + '_open', function(context) {});
            c['open_' + local_role](fields);
        };
    }

    function open_sender_test(fields, verification) {
        return open_test('sender', fields, verification);
    }
    function open_receiver_test(fields, verification) {
        return open_test('receiver', fields, verification);
    }

    function close_test(local_role, error, verification) {
        var remote_role = local_role === 'sender' ? 'receiver' : 'sender';
        return function(done) {
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
    function close_sender_test(error, verification) {
        return close_test('sender', error, verification);
    }
    function close_receiver_test(error, verification) {
        return close_test('receiver', error, verification);
    }

    afterEach(function() {
        listener.close();
    });

    var link_types = ['sender', 'receiver'];
    for (var i = 0; i < link_types.length; i++) {
        var t = link_types[i];
        it(t + ' name', open_test(t, {name:'my-link'}, function(link) {
            assert.equal(link.remote.attach.name, 'my-link');
        }));
        it('single offered ' + t + ' capability', open_test(t, {offered_capabilities:'foo'}, function(link) {
            assert.equal(link.remote.attach.offered_capabilities, 'foo');
        }));
        it('multiple offered ' + t + ' capabilities', open_test(t, {offered_capabilities:['foo', 'bar']}, function(link) {
            assert.equal(link.remote.attach.offered_capabilities.length, 2);
            assert.equal(link.remote.attach.offered_capabilities[0], 'foo');
            assert.equal(link.remote.attach.offered_capabilities[1], 'bar');
        }));
        it('single desired ' + t + ' capability', open_test(t, {desired_capabilities:'foo'}, function(link) {
            assert.equal(link.remote.attach.desired_capabilities, 'foo');
        }));
        it('multiple desired ' + t + ' capabilities', open_test(t, {desired_capabilities:['a', 'b', 'c']}, function(link) {
            assert.equal(link.remote.attach.desired_capabilities.length, 3);
            assert.equal(link.remote.attach.desired_capabilities[0], 'a');
            assert.equal(link.remote.attach.desired_capabilities[1], 'b');
            assert.equal(link.remote.attach.desired_capabilities[2], 'c');
        }));
        it(t + ' properties', open_test(t, {properties:{flavour:'vanilla', scoops:2, cone:true}}, function(link) {
            assert.equal(link.remote.attach.properties.flavour, 'vanilla');
            assert.equal(link.remote.attach.properties.scoops, 2);
            assert.equal(link.remote.attach.properties.cone, true);
        }));
        it('error on ' + t + ' close', close_test(t, {condition:'amqp:link:detach-forced', description:'testing error on close'}, function(link) {
            var error = link.remote.detach.error;
            assert.equal(error.condition, 'amqp:link:detach-forced');
            assert.equal(error.description, 'testing error on close');
        }));
    }
});

var roles = {'sender':'receiver', 'receiver':'sender'};
for (var local_role in roles) {
    describe(local_role + ' events', function() {
        var listener;

        beforeEach(function(done) {
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

        it('dispatches events to correct handlers', function(done) {
            var latch = {
                count: 3,
                decrement: function() {
                    if (--this.count == 0) done();
                }
            };
            var container = rhea.create_container();

            var c = container.connect(listener.address());
            c.on(local_role + '_open', function (context) {
                assert.equal(context[local_role].remote.attach.offered_capabilities, 'one');
                latch.decrement();
                context[local_role].close();
            });
            c['open_' + local_role]({desired_capabilities:'one'});
            var s2 = c['open_' + local_role]({desired_capabilities:'two'});
            s2.on(local_role + '_open', function (context) {
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
}
