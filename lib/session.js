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

var frames = require('./frames.js');
var link = require('./link.js');
var log = require('./log.js');
var message = require('./message.js');
var types = require('./types.js');
var util = require('./util.js');
var EndpointState = require('./endpoint.js');

var EventEmitter = require('events').EventEmitter;

var CircularBuffer = function (capacity) {
    this.capacity = capacity;
    this.size = 0;
    this.head = 0;
    this.tail = 0;
    this.entries = [];
};

CircularBuffer.prototype.available = function () {
    return this.capacity - this.size;
};

CircularBuffer.prototype.push = function (o) {
    if (this.size < this.capacity) {
        this.entries[this.tail] = o;
        this.tail = (this.tail + 1) % this.capacity;
        this.size++;
    } else {
        throw Error('circular buffer overflow: head=' + this.head + ' tail=' + this.tail + ' size=' + this.size + ' capacity=' + this.capacity);
    }
};

CircularBuffer.prototype.pop_if = function (f) {
    var count = 0;
    while (this.size && f(this.entries[this.head])) {
        this.entries[this.head] = undefined;
        this.head = (this.head + 1) % this.capacity;
        this.size--;
        count++;
    }
    return count;
};

CircularBuffer.prototype.by_id = function (id) {
    if (this.size > 0) {
        var gap = id - this.entries[this.head].id;
        if (gap < this.size) {
            return this.entries[(this.head + gap) % this.capacity];
        }
    }
    return undefined;
};

CircularBuffer.prototype.get_head = function () {
    return this.size > 0 ? this.entries[this.head] : undefined;
};

CircularBuffer.prototype.get_tail = function () {
    return this.size > 0 ? this.entries[(this.head + this.size - 1) % this.capacity] : undefined;
};

function write_dispositions(deliveries) {
    var first, last, next_id, i, delivery;

    for (i = 0; i < deliveries.length; i++) {
        delivery = deliveries[i];
        if (first === undefined) {
            first = delivery;
            last = delivery;
            next_id = delivery.id;
        }

        if (!message.are_outcomes_equivalent(last.state, delivery.state) || last.settled !== delivery.settled || next_id !== delivery.id) {
            first.link.session.output(frames.disposition({'role' : first.link.is_receiver(), 'first' : first.id, 'last' : last.id, 'state' : first.state, 'settled' : first.settled}).described());
            first = delivery;
            last = delivery;
            next_id = delivery.id;
        } else {
            if (last.id !== delivery.id) {
                last = delivery;
            }
            next_id++;
        }
    }
    if (first !== undefined && last !== undefined) {
        first.link.session.output(frames.disposition({'role' : first.link.is_receiver(), 'first' : first.id, 'last' : last.id, 'state' : first.state, 'settled' : first.settled}).described());
    }
}

var Outgoing = function (connection) {
    /* TODO: make size configurable? */
    this.deliveries = new CircularBuffer(2048);
    this.updated = [];
    this.pending_dispositions = [];
    this.next_delivery_id = 0;
    this.next_pending_delivery = 0;
    this.next_transfer_id = 0;
    this.window = types.MAX_UINT;
    this.remote_next_transfer_id = undefined;
    this.remote_window = undefined;
    this.connection = connection;
};

Outgoing.prototype.available = function () {
    return this.deliveries.available();
};

Outgoing.prototype.compute_max_payload = function (tag) {
    if (this.connection.max_frame_size) {
        return this.connection.max_frame_size - (50 + tag.length);
    } else {
        return undefined;
    }
};

Outgoing.prototype.send = function (sender, tag, data, format) {
    var fragments = [];
    var max_payload = this.compute_max_payload(tag);
    if (max_payload && data.length > max_payload) {
        var start = 0;
        while (start < data.length) {
            var end = Math.min(start + max_payload, data.length);
            fragments.push(data.slice(start, end));
            start = end;
        }
    } else {
        fragments.push(data);
    }
    var d = {
        'id':this.next_delivery_id++,
        'tag':tag,
        'link':sender,
        'data': fragments,
        'format':format ? format : 0,
        'sent': false,
        'settled': false,
        'state': undefined,
        'remote_settled': false,
        'remote_state': undefined
    };
    var self = this;
    d.update = function (settled, state) {
        self.update(d, settled, state);
    };
    this.deliveries.push(d);
    return d;
};

Outgoing.prototype.on_begin = function (fields) {
    this.remote_window = fields.incoming_window;
};

Outgoing.prototype.on_flow = function (fields) {
    this.remote_next_transfer_id = fields.next_incoming_id;
    this.remote_window = fields.incoming_window;
};

Outgoing.prototype.on_disposition = function (fields) {
    var last = fields.last ? fields.last : fields.first;
    for (var i = fields.first; i <= last; i++) {
        var d = this.deliveries.by_id(i);
        if (d && !d.remote_settled) {
            var updated = false;
            if (fields.settled) {
                d.remote_settled = fields.settled;
                updated = true;
            }
            if (fields.state && fields.state !== d.remote_state) {
                d.remote_state = message.unwrap_outcome(fields.state);
                updated = true;
            }
            if (updated) {
                this.updated.push(d);
            }
        }
    }
};

Outgoing.prototype.update = function (delivery, settled, state) {
    if (delivery) {
        delivery.settled = settled;
        if (state !== undefined) delivery.state = state;
        if (!delivery.remote_settled) {
            this.pending_dispositions.push(delivery);
        }
        delivery.link.connection._register();
    }
};

Outgoing.prototype.transfer_window = function() {
    if (this.remote_window) {
        return this.remote_window - (this.next_transfer_id - this.remote_next_transfer_id);
    } else {
        return 0;
    }
};

Outgoing.prototype.process = function() {
    var d;
    // send pending deliveries for which there is credit:
    while (this.next_pending_delivery < this.next_delivery_id) {
        d = this.deliveries.by_id(this.next_pending_delivery);
        if (d) {
            if (d.link.has_credit()) {
                if (this.transfer_window() >= d.data.length) {
                    this.window -= d.data.length;
                    for (var i = 0; i < d.data.length; i++) {
                        this.next_transfer_id++;
                        var more = (i+1) < d.data.length;
                        var transfer = frames.transfer({'handle':d.link.local.handle,'message_format':d.format,'delivery_id':d.id, 'delivery_tag':d.tag, 'settled':d.settled, 'more':more});
                        d.link.session.output(transfer.described(), d.data[i]);
                    }
                    d.link.credit--;
                    d.link.delivery_count++;
                    this.next_pending_delivery++;
                } else {
                    log.flow('Incoming window of peer preventing sending further transfers: remote_window=%d, remote_next_transfer_id=%d, next_transfer_id=%d',
                        this.remote_window, this.remote_next_transfer_id, this.next_transfer_id);
                    break;
                }
            } else {
                log.flow('Link has no credit');
                break;
            }
        } else {
            console.error('ERROR: Next pending delivery not found: ' + this.next_pending_delivery);
            break;
        }
    }

    // notify application of any updated deliveries:
    for (var i = 0; i < this.updated.length; i++) {
        d = this.updated[i];
        if (d.remote_state && d.remote_state.constructor.composite_type) {
            d.link.dispatch(d.remote_state.constructor.composite_type, d.link._context({'delivery':d}));
        }
        if (d.remote_settled) d.link.dispatch('settled', d.link._context({'delivery':d}));
    }
    this.updated = [];

    if (this.pending_dispositions.length) {
        write_dispositions(this.pending_dispositions);
        this.pending_dispositions = [];
    }

    // remove any fully settled deliveries:
    this.deliveries.pop_if(function (d) { return d.settled && d.remote_settled; });
};

var Incoming = function () {
    this.deliveries = new CircularBuffer(2048/*TODO: configurable?*/);
    this.updated = [];
    this.next_transfer_id = 0;
    this.next_delivery_id = undefined;
    Object.defineProperty(this, 'window', { get: function () { return this.deliveries.available(); } });
    this.remote_next_transfer_id = undefined;
    this.remote_window = undefined;
    this.max_transfer_id = this.next_transfer_id + this.window;
};

Incoming.prototype.update = function (delivery, settled, state) {
    if (delivery) {
        delivery.settled = settled;
        if (state !== undefined) delivery.state = state;
        if (!delivery.remote_settled) {
            this.updated.push(delivery);
        }
        delivery.link.connection._register();
    }
};

Incoming.prototype.on_transfer = function(frame, receiver) {
    this.next_transfer_id++;
    if (receiver.is_remote_open()) {
        if (this.next_delivery_id === undefined) {
            this.next_delivery_id = frame.performative.delivery_id;
        }
        var current;
        var data;
        var last = this.deliveries.get_tail();
        if (last && last.incomplete) {
            if (util.is_defined(frame.performative.delivery_id) && this.next_delivery_id !== frame.performative.delivery_id) {
                //TODO: better error handling
                throw Error('frame sequence error: delivery ' + this.next_delivery_id + ' not complete, got ' + frame.performative.delivery_id);
            }
            current = last;
            data = Buffer.concat([current.data, frame.payload], current.data.length + frame.payload.length);
        } else if (this.next_delivery_id === frame.performative.delivery_id) {
            current = {'id':frame.performative.delivery_id,
                'tag':frame.performative.delivery_tag,
                'format':frame.performative.message_format,
                'link':receiver,
                'settled': false,
                'state': undefined,
                'remote_settled': frame.performative.settled === undefined ? false : frame.performative.settled,
                'remote_state': frame.performative.state};
            var self = this;
            current.update = function (settled, state) {
                var settled_ = settled;
                if (settled_ === undefined) {
                    settled_ = receiver.local.attach.rcv_settle_mode !== 1;
                }
                self.update(current, settled_, state);
            };
            current.accept = function () { this.update(undefined, message.accepted().described()); };
            current.release = function (params) {
                if (params) {
                    this.update(undefined, message.modified(params).described());
                } else {
                    this.update(undefined, message.released().described());
                }
            };
            current.reject = function (error) { this.update(true, message.rejected({'error':error}).described()); };
            current.modified = function (params) { this.update(true, message.modified(params).described()); };

            this.deliveries.push(current);
            data = frame.payload;
        } else {
            //TODO: better error handling
            throw Error('frame sequence error: expected ' + this.next_delivery_id + ', got ' + frame.performative.delivery_id);
        }
        current.incomplete = frame.performative.more;
        if (current.incomplete) {
            current.data = data;
        } else {
            receiver.credit--;
            receiver.delivery_count++;
            this.next_delivery_id++;
            var msgctxt = current.format === 0 ? {'message':message.decode(data), 'delivery':current} : {'message':data, 'delivery':current, 'format':current.format};
            receiver.dispatch('message', receiver._context(msgctxt));
        }
    } else {
        throw Error('transfer after detach');
    }
};

Incoming.prototype.process = function (session) {
    if (this.updated.length > 0) {
        write_dispositions(this.updated);
        this.updated = [];
    }

    // remove any fully settled deliveries:
    this.deliveries.pop_if(function (d) { return d.settled; });

    if (this.max_transfer_id - this.next_transfer_id < (this.window / 2)) {
        session._write_flow();
    }
};

Incoming.prototype.on_begin = function (fields) {
    this.remote_window = fields.outgoing_window;
    this.remote_next_transfer_id = fields.next_outgoing_id;
};

Incoming.prototype.on_flow = function (fields) {
    this.remote_next_transfer_id = fields.next_outgoing_id;
    this.remote_window = fields.outgoing_window;
};

Incoming.prototype.on_disposition = function (fields) {
    var last = fields.last ? fields.last : fields.first;
    for (var i = fields.first; i <= last; i++) {
        var d = this.deliveries.by_id(i);
        if (d && !d.remote_settled) {
            if (fields.settled) {
                d.remote_settled = fields.settled;
                d.link.dispatch('settled', d.link._context({'delivery':d}));
            }
        }
    }
};

var Session = function (connection, local_channel) {
    this.connection = connection;
    this.outgoing = new Outgoing(connection);
    this.incoming = new Incoming();
    this.state = new EndpointState();
    this.local = {'channel': local_channel, 'handles':{}};
    this.local.begin = frames.begin({next_outgoing_id:this.outgoing.next_transfer_id,incoming_window:this.incoming.window,outgoing_window:this.outgoing.window});
    this.local.end = frames.end();
    this.remote = {'handles':{}};
    this.links = {}; // map by name
    this.options = {};
};
Session.prototype = Object.create(EventEmitter.prototype);
Session.prototype.constructor = Session;

Session.prototype.reset = function() {
    this.state.disconnected();
    this.outgoing = new Outgoing(this.connection);
    this.incoming = new Incoming();
    this.remote = {'handles':{}};
    for (var l in this.links) {
        this.links[l].reset();
    }
};

Session.prototype.dispatch = function(name) {
    log.events('Session got event: %s', name);
    if (this.listeners(name).length) {
        EventEmitter.prototype.emit.apply(this, arguments);
        return true;
    } else {
        return this.connection.dispatch.apply(this.connection, arguments);
    }
};
Session.prototype.output = function (frame, payload) {
    this.connection._write_frame(this.local.channel, frame, payload);
};

Session.prototype.create_sender = function (name, opts) {
    return this.create_link(name, link.Sender, opts);
};

Session.prototype.create_receiver = function (name, opts) {
    return this.create_link(name, link.Receiver, opts);
};

function merge(defaults, specific) {
    for (var f in specific) {
        if (f === 'properties' && defaults.properties) {
            merge(defaults.properties, specific.properties);
        } else {
            defaults[f] = specific[f];
        }
    }
}

function attach(factory, args, remote_terminus, default_args) {
    var opts = Object.create(default_args || {});
    if (typeof args === 'string') {
        opts[remote_terminus] = args;
    } else if (args) {
        merge(opts, args);
    }
    if (!opts.name) opts.name = util.generate_uuid();
    var l = factory(opts.name, opts);
    for (var t in {'source':0, 'target':0}) {
        if (opts[t]) {
            if (typeof opts[t] === 'string') {
                opts[t] = {'address' : opts[t]};
            }
            l['set_' + t](opts[t]);
        }
    }
    if (l.is_sender() && opts.source === undefined) {
        opts.source = l.set_source({});
    }
    if (l.is_receiver() && opts.target === undefined) {
        opts.target = l.set_target({});
    }
    l.attach();
    return l;
}

Session.prototype.get_option = function (name, default_value) {
    if (this.options[name] !== undefined) return this.options[name];
    else return this.connection.get_option(name, default_value);
};

Session.prototype.attach_sender = function (args) {
    return attach(this.create_sender.bind(this), args, 'target', this.get_option('sender_options', {}));
};
Session.prototype.open_sender = Session.prototype.attach_sender;//alias

Session.prototype.attach_receiver = function (args) {
    return attach(this.create_receiver.bind(this), args, 'source', this.get_option('receiver_options', {}));
};
Session.prototype.open_receiver = Session.prototype.attach_receiver;//alias

Session.prototype.find_sender = function (filter) {
    return this.find_link(util.sender_filter(filter));
};

Session.prototype.find_receiver = function (filter) {
    return this.find_link(util.receiver_filter(filter));
};

Session.prototype.find_link = function (filter) {
    for (var name in this.links) {
        var link = this.links[name];
        if (filter(link)) return link;
    }
    return undefined;
};

Session.prototype.each_receiver = function (action, filter) {
    this.each_link(util.receiver_filter(filter));
};

Session.prototype.each_sender = function (action, filter) {
    this.each_link(util.sender_filter(filter));
};

Session.prototype.each_link = function (action, filter) {
    for (var name in this.links) {
        var link = this.links[name];
        if (filter === undefined || filter(link)) action(link);
    }
};

Session.prototype.create_link = function (name, constructor, opts) {
    var i = 0;
    while (this.local.handles[i]) i++;
    var l = new constructor(this, name, i, opts);
    this.links[name] = l;
    this.local.handles[i] = l;
    return l;
};

Session.prototype.begin = function () {
    if (this.state.open()) {
        this.connection._register();
    }
};
Session.prototype.open = Session.prototype.begin;

Session.prototype.end = function (error) {
    if (error) this.local.end.error = error;
    if (this.state.close()) {
        this.connection._register();
    }
};
Session.prototype.close = Session.prototype.end;

Session.prototype.is_open = function () {
    return this.connection.is_open() && this.state.is_open();
};

Session.prototype.is_remote_open = function () {
    return this.connection.is_remote_open() && this.state.remote_open;
};

Session.prototype.is_closed = function () {
    return this.connection.is_closed() || this.state.is_closed();
};

Session.prototype._process = function () {
    do {
        if (this.state.need_open()) {
            this.output(this.local.begin.described());
        }

        this.outgoing.process();
        this.incoming.process(this);
        for (var k in this.links) {
            this.links[k]._process();
        }

        if (this.state.need_close()) {
            this.output(this.local.end.described());
        }
    } while (!this.state.has_settled());
};

Session.prototype.send = function (sender, tag, data, format) {
    var d = this.outgoing.send(sender, tag, data, format);
    this.connection._register();
    return d;
};

Session.prototype._write_flow = function (link) {
    var fields = {'next_incoming_id':this.incoming.next_transfer_id,
        'incoming_window':this.incoming.window,
        'next_outgoing_id':this.outgoing.next_transfer_id,
        'outgoing_window':this.outgoing.window
    };
    this.incoming.max_transfer_id = fields.next_incoming_id + fields.incoming_window;
    if (link) {
        if (link._get_drain()) fields.drain = true;
        fields.delivery_count = link.delivery_count;
        fields.handle = link.local.handle;
        fields.link_credit = link.credit;
    }
    this.output(frames.flow(fields).described());
};

Session.prototype.on_begin = function (frame) {
    if (this.state.remote_opened()) {
        if (!this.remote.channel) {
            this.remote.channel = frame.channel;
        }
        this.remote.begin = frame.performative;
        this.outgoing.on_begin(frame.performative);
        this.incoming.on_begin(frame.performative);
        this.open();
        this.dispatch('session_open', this._context());
    } else {
        throw Error('Begin already received');
    }
};
Session.prototype.on_end = function (frame) {
    if (this.state.remote_closed()) {
        this.remote.end = frame.performative;
        this.close();
        this.dispatch('session_close', this._context());
    } else {
        throw Error('End already received');
    }
};

Session.prototype.on_attach = function (frame) {
    var name = frame.performative.name;
    var link = this.links[name];
    if (!link) {
        // if role is true, peer is receiver, so we are sender
        link = frame.performative.role ? this.create_sender(name) : this.create_receiver(name);
    }
    this.remote.handles[frame.performative.handle] = link;
    link.on_attach(frame);
    link.remote.attach = frame.performative;
};

Session.prototype.on_disposition = function (frame) {
    if (frame.performative.role) {
        log.events('Received disposition for outgoing transfers');
        this.outgoing.on_disposition(frame.performative);
    } else {
        log.events('Received disposition for incoming transfers');
        this.incoming.on_disposition(frame.performative);
    }
    this.connection._register();
};

Session.prototype.on_flow = function (frame) {
    this.outgoing.on_flow(frame.performative);
    this.incoming.on_flow(frame.performative);
    if (util.is_defined(frame.performative.handle)) {
        this._get_link(frame).on_flow(frame);
    }
    this.connection._register();
};

Session.prototype._context = function (c) {
    var context = c ? c : {};
    context.session = this;
    return this.connection._context(context);
};

Session.prototype._get_link = function (frame) {
    var handle = frame.performative.handle;
    var link = this.remote.handles[handle];
    if (!link) {
        throw Error('Invalid handle ' + handle);
    }
    return link;
};

Session.prototype.on_detach = function (frame) {
    this._get_link(frame).on_detach(frame);
    //remove link
    var handle = frame.performative.handle;
    var link = this.remote.handles[handle];
    delete this.remote.handles[handle];
    delete this.local.handles[link.local.handle];
    delete this.links[link.name];
};

Session.prototype.remove_link = function (link) {
    delete this.remote.handles[link.remote.handle];
    delete this.local.handles[link.local.handle];
    delete this.links[link.name];
};

/**
 * This forcibly removes the session from the parent connection. It
 * should not be called for a link on an active connection, where
 * close() should be used instead.
 */
Session.prototype.remove = function () {
    this.connection.remove_session(this);
};

Session.prototype.on_transfer = function (frame) {
    this.incoming.on_transfer(frame, this._get_link(frame));
};

module.exports = Session;
