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

var log = require('./log.js');
var types = require('./types.js');

var by_descriptor = {};
var unwrappers = {};
var wrappers = [];
var message = {};

function define_section(descriptor, unwrap, wrap) {
    unwrap.descriptor = descriptor;
    unwrappers[descriptor.symbolic] = unwrap;
    unwrappers[Number(descriptor.numeric).toString(10)] = unwrap;
    if (wrap) {
        wrappers.push(wrap);
    }
};

function define_composite_section(def) {
    var c = types.define_composite(def);
    message[def.name] = c.create;
    by_descriptor[Number(c.descriptor.numeric).toString(10)] = c;
    by_descriptor[c.descriptor.symbolic] = c;

    var unwrap = function (msg, section) {
        msg[def.name] = new c(section.value);
    };

    var wrap = function (sections, msg) {
        if (msg[def.name]) {
            if (msg[def.name].described) {
                sections.push(msg[def.name].described());
            } else {
                sections.push(c.create(msg[def.name]).described());
            }
        }
    };
    define_section(c.descriptor, unwrap, wrap);
};


function define_map_section(def) {
    var descriptor = {numeric:def.code};
    descriptor.symbolic = 'amqp:' + def.name.replace(/_/g, '-') + ':map';
    var unwrap = function (msg, section) {
        msg[def.name] = types.unwrap(section);
    };
    var wrap = function (sections, msg) {
        if (msg[def.name]) {
            sections.push(types.described(types.wrap_ulong(descriptor.numeric), types.wrap_map(msg[def.name])));
        }
    };
    define_section(descriptor, unwrap, wrap);
};

define_composite_section({name:"header",
                          code:0x70,
                          fields:[
                              {name:"durable", type:"boolean", default_value:false},
                              {name:"priority", type:"ubyte", default_value:4},
                              {name:"ttl", type:"uint"},
                              {name:"first_acquirer", type:"boolean", default_value:false},
                              {name:"delivery_count", type:"uint", default_value:0}
                          ]
                         });
define_map_section({name:"delivery_annotations", code:0x71});
define_map_section({name:"message_annotations", code:0x72});
define_composite_section({name:"properties",
                          code:0x73,
                          fields:[
                              {name:"message_id", type:"message_id"},
                              {name:"user_id", type:"binary"},
                              {name:"to", type:"string"},
                              {name:"subject", type:"string"},
                              {name:"reply_to", type:"string"},
                              {name:"correlation_id", type:"message_id"},
                              {name:"content_type", type:"symbol"},
                              {name:"content_encoding", type:"symbol"},
                              {name:"absolute_expiry_time", type:"timestamp"},
                              {name:"creation_time", type:"timestamp"},
                              {name:"group_id", type:"string"},
                              {name:"group_sequence", type:"uint"},
                              {name:"reply_to_group_id", type:"string"}
                          ]
                         });
define_map_section({name:"application_properties", code:0x74});

define_section({numeric:0x77, symbolic:'amqp:value:*'},
               function(msg, section) { msg.body = types.unwrap(section); },
               function(sections, msg) { sections.push(types.described(types.wrap_ulong(0x77), types.wrap(msg.body))); });

define_map_section({name:"footer", code:0x78});

message.encode = function(obj) {
    var sections = [];

    wrappers.forEach(function (wrapper_fn) { wrapper_fn(sections, obj); });
    var writer = new types.Writer();
    for (var i = 0; i < sections.length; i++) {
        log.message('Encoding section ' + (i+1) + ' of ' + sections.length + ': ' + sections[i]);
        writer.write(sections[i]);
    }
    var data = writer.toBuffer();
    log.message('encoded ' + data.length + ' bytes');
    return data;
}

message.decode = function(buffer) {
    var msg = {};
    var reader = new types.Reader(buffer);
    while (reader.remaining()) {
        var s = reader.read();
        log.message('decoding section: ' + JSON.stringify(s) + ' of type: ' + JSON.stringify(s.descriptor));
        if (s.descriptor) {
            var unwrap = unwrappers[s.descriptor.value];
            if (unwrap) {
                unwrap(msg, s);
            } else {
                console.log("WARNING: did not recognise message section with descriptor " + s.descriptor);
            }
        } else {
            console.log("WARNING: expected described message section got " + JSON.stringify(s));
        }
    }
    return msg;
}

var outcomes = {};

function define_outcome(def) {
    var c = types.define_composite(def);
    c.composite_type = def.name;
    message[def.name] = c.create;
    outcomes[Number(c.descriptor.numeric).toString(10)] = c;
    outcomes[c.descriptor.symbolic] = c;
    message['is_' + def.name] = function (o) {
        if (o && o.descriptor) {
            var c = outcomes[o.descriptor.value];
            if (c) {
                return c.descriptor.numeric == def.code;
            }
        }
        return false;
    };
}

message.unwrap_outcome = function (outcome) {
    if (outcome && outcome.descriptor) {
        var c = outcomes[outcome.descriptor.value];
        if (c) {
            return new c(outcome);
        }
    }
    console.log('unrecognised outcome');
    return outcome;
};

message.are_outcomes_equivalent = function(a, b) {
    if (a === undefined && b === undefined) return true;
    else if (a === undefined || b === undefined) return false;
    else return a.descriptor.value == b.descriptor.value && JSON.stringify(a) == JSON.stringify(b);
};

define_outcome({name:"received", code:0x23,
                fields:[
                    {name:"section-number", type:"uint", mandatory:true},
                    {name:"section-offset", type:"ulong", mandatory:true}
                ]});
define_outcome({name:"accepted", code:0x24, fields:[]});
define_outcome({name:"rejected", code:0x25, fields:[{name:"error", type:"error"}]});
define_outcome({name:"released", code:0x26, fields:[]});
define_outcome({name:"modified",
 code:0x27,
 fields:[
     {name:"delivery-failed", type:"boolean"},
     {name:"undeliverable-here", type:"boolean"},
     {name:"message-annotations", type:"fields"}
]});

module.exports = message;
