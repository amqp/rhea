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
var log = require('./log.js');
var message = require('./message.js');
var terminus = require('./terminus.js')
var types = require('./types.js')
var EndpointState = require('./endpoint.js');

var FlowController = function (window) {
    this.window = window;
};
FlowController.prototype.update = function (context) {
    var delta = this.window - context.receiver.credit;
    context.receiver.flow(delta);
};

function auto_settle(context) {
    context.delivery.settled = true;
};

function auto_accept(context) {
    context.delivery.update(true, message.accepted().described());
};

var EventEmitter = require('events').EventEmitter;

var link = Object.create(EventEmitter.prototype);
link.dispatch = function(name, context) {
    log.events('Link got event: '+ name);
    EventEmitter.prototype.emit.apply(this.observers, arguments);
    if (this.listeners(name).length) {
        EventEmitter.prototype.emit.apply(this, arguments);
    } else {
        this.session.dispatch.apply(this.session, arguments);
    }
};
link.set_source = function (fields) {
    this.local.attach.source = terminus.source(fields).described();
};
link.set_target = function (fields) {
    this.local.attach.target = terminus.target(fields).described();
};

link.attach = function () {
    if (this.state.open()) {
        this.connection._register();
    }
};
link.open = link.attach;

link.detach = function () {
    this.local.detach.closed = false;
    if (this.state.close()) {
        this.connection._register();
    }
};
link.close = function() {
    this.local.detach.closed = true;
    if (this.state.close()) {
        this.connection._register();
    }
}

link.is_open = function () {
    return this.session.is_open() && this.state.is_open();
};

link.is_closed = function () {
    return this.session.is_closed() || this.state.is_closed();
};

link._process = function () {
    do {
        if (this.state.need_open()) {
            this.session.output(this.local.attach.described());
        }

        if (this.issue_flow) {
            this.session._write_flow(this);
            this.issue_flow = false;
        }

        if (this.state.need_close()) {
            this.session.output(this.local.detach.described());
        }
    } while (!this.state.has_settled());
};

link.on_attach = function (frame) {
    if (this.state.remote_opened()) {
        if (!this.remote.handle) {
            this.remote.handle = frame.handle;
        }
        frame.performative.source = terminus.unwrap(frame.performative.source);
        frame.performative.target = terminus.unwrap(frame.performative.target);
        this.remote.attach = frame.performative;
        this.open();
        this.dispatch(this.is_receiver() ? 'receiver_open' : 'sender_open', this._context());
    } else {
        throw Error('Attach already received');
    }
};

link.on_detach = function (frame) {
    if (this.state.remote_closed()) {
        this.remote.detach = frame.performative;
        this.close();
        this.dispatch(this.local.attach.role ? 'receiver_close' : 'sender_close', this._context());
    } else {
        throw Error('Detach already received');
    }
};

function is_internal(name) {
    switch (name) {
    case 'handle':
    case 'role':
    case 'initial_delivery_count':
        return true;
    default:
        return false;
    }
}

link.init = function (session, name, local_handle, opts, is_receiver) {
    this.session = session;
    this.connection = session.connection;
    this.name = name;
    this.options = opts === undefined ? {} : opts;
    this.state = new EndpointState();
    this.issue_flow = false;//currently only used by receiver
    this.local = {'handle': local_handle};
    this.local.attach = frames.attach({'handle':local_handle,'name':name, role:is_receiver});
    for (var f in this.local.attach) {
        if (!is_internal(f) && this.options[f] !== undefined) {
            this.local.attach[f] = this.options[f];
        }
    }
    this.local.detach = frames.detach({'handle':local_handle, 'closed':true});
    this.remote = {'handle':undefined};
    this.delivery_count = 0;
    this.credit = 0;
    this.observers = new EventEmitter();
};
link.reset = function() {
    this.state.disconnected();
    this.remote = {'handle':undefined};
    this.delivery_count = 0;
    this.credit = 0;
};

link.has_credit = function () {
    return this.credit > 0;
};
link.is_receiver = function () {
    return this.local.attach.role;
};
link._context = function (c) {
    var context = c ? c : {};
    if (this.is_receiver()) {
        context.receiver = this;
    } else {
        context.sender = this;
    }
    return this.session._context(context);
};
link.get_option = function (name, default_value) {
    if (this.options[name] !== undefined) return this.options[name];
    else return this.session.get_option(name, default_value);
};

var Sender = function (session, name, local_handle, opts) {
    this.init(session, name, local_handle, opts, false);
    this.local.attach.initial_delivery_count = 0;
    this.tag = 0;
    if (this.get_option('autosettle', true)) {
        this.observers.on('settled', auto_settle);
    }
};
Sender.prototype = Object.create(link);
Sender.prototype.constructor = Sender;
Sender.prototype.next_tag = function () {
    return new String(this.tag++);
};
Sender.prototype.sendable = function (frame) {
    return this.credit && this.session.outgoing.available();
}
Sender.prototype.on_flow = function (frame) {
    var flow = frame.performative;
    this.credit = flow.delivery_count + flow.link_credit - this.delivery_count;
    if (this.is_open()) {
        this.dispatch('sender_flow', this._context());
        if (this.sendable()) {
            this.dispatch('sendable', this._context());
        }
    }
};
Sender.prototype.on_transfer = function (frame) {
    throw Error('got transfer on sending link');
};
Sender.prototype.send = function (msg, tag) {
    return this.session.send(this, tag ? tag : this.next_tag(), message.encode(msg), 0);
};


var Receiver = function (session, name, local_handle, opts) {
    this.init(session, name, local_handle, opts, true);
    this.set_prefetch(this.get_option('prefetch', 100));
    if (this.get_option('autoaccept', true)) {
        this.observers.on('message', auto_accept);
    }
};
Receiver.prototype = Object.create(link);
Receiver.prototype.constructor = Receiver;
Receiver.prototype.on_flow = function (frame) {
    this.dispatch('receiver_flow', this._context());
};
Receiver.prototype.flow = function(credit) {
    if (credit > 0) {
        this.credit += credit;
        this.issue_flow = true;
        this.connection._register();
    }
};

Receiver.prototype.set_prefetch = function(prefetch) {
    if (prefetch > 0) {
        var flow_controller = new FlowController(prefetch);
        var listener = flow_controller.update.bind(flow_controller);
        this.observers.on('message', listener);
        this.observers.on('receiver_open', listener);
    }
}

module.exports = {'Sender': Sender, 'Receiver':Receiver};
