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

var errors = require('./errors.js');
var frames = require('./frames.js');
var log = require('./log.js');
var sasl = require('./sasl.js');
var util = require('./util.js');
var EndpointState = require('./endpoint.js');
var Session = require('./session.js');
var Transport = require('./transport.js');

var net = require('net');
var tls = require('tls');
var EventEmitter = require('events').EventEmitter;

var AMQP_PROTOCOL_ID = 0x00;

function get_socket_id(socket) {
    if (socket.get_id_string) return socket.get_id_string();
    return socket.localAddress + ':' + socket.localPort + ' -> ' + socket.remoteAddress + ':' + socket.remotePort;
}

function session_per_connection(conn) {
    var ssn = null;
    return {
        'get_session' : function () {
            if (!ssn) {
                ssn = conn.create_session();
                ssn.begin();
            }
            return ssn;
        }
    };
}

function restrict(count, f) {
    if (count) {
        var current = count;
        var reset;
        return function (successful_attempts) {
            if (reset !== successful_attempts) {
                current = count;
                reset = successful_attempts;
            }
            if (current--) return f(successful_attempts);
            else return -1;
        };
    } else {
        return f;
    }
}

function backoff(initial, max) {
    var delay = initial;
    var reset;
    return function (successful_attempts) {
        if (reset !== successful_attempts) {
            delay = initial;
            reset = successful_attempts;
        }
        var current = delay;
        var next = delay*2;
        delay = max > next ? next : max;
        return current;
    };
}

function get_connect_fn(options) {
    if (options.transport === undefined || options.transport === 'tcp') {
        return net.connect;
    } else if (options.transport === 'tls' || options.transport === 'ssl') {
        return tls.connect;
    } else {
        throw Error('Unrecognised transport: ' + options.transport);
    }
}

function connection_details(options) {
    var details = {};
    details.connect = options.connect ? options.connect : get_connect_fn(options);
    details.host = options.host ? options.host : 'localhost';
    details.port = options.port ? options.port : 5672;
    details.options = options;
    return details;
}

var aliases = [
    'container_id',
    'hostname',
    'max_frame_size',
    'channel_max',
    'idle_time_out',
    'outgoing_locales',
    'incoming_locales',
    'offered_capabilities',
    'desired_capabilities',
    'properties'
];

function remote_property_shortcut(name) {
    return function() { return this.remote.open ? this.remote.open[name] : undefined; };
}

var conn_counter = 1;

var Connection = function (options, container) {
    this.options = {};
    if (options) {
        for (var k in options) {
            this.options[k] = options[k];
        }
        if ((options.transport === 'tls' || options.transport === 'ssl')
            && options.servername === undefined && options.host !== undefined) {
            this.options.servername = options.host;
        }
    }
    this.container = container;
    if (!this.options.id) {
        this.options.id = 'connection-' + conn_counter++;
    }
    if (!this.options.container_id) {
        this.options.container_id = container ? container.id : util.generate_uuid();
    }
    if (!this.options.connection_details) {
        var self = this;
        this.options.connection_details = function() { return connection_details(self.options); };
    }
    var reconnect = this.get_option('reconnect', true);
    if (typeof reconnect === 'boolean' && reconnect) {
        var initial = this.get_option('initial_reconnect_delay', 100);
        var max = this.get_option('max_reconnect_delay', 60000);
        this.options.reconnect = restrict(this.get_option('reconnect_limit'), backoff(initial, max));
    } else if (typeof reconnect === 'number') {
        var fixed = this.options.reconnect;
        this.options.reconnect = restrict(this.get_option('reconnect_limit'), function () { return fixed; });
    }
    this.registered = false;
    this.state = new EndpointState();
    this.local_channel_map = {};
    this.remote_channel_map = {};
    this.local = {};
    this.remote = {};
    this.local.open = frames.open(this.options);
    this.local.close = frames.close({});
    this.session_policy = session_per_connection(this);
    this.amqp_transport = new Transport(this.options.id, AMQP_PROTOCOL_ID, frames.TYPE_AMQP, this);
    this.sasl_transport = undefined;
    this.transport = this.amqp_transport;
    this.conn_established_counter = 0;
    this.heartbeat_out = undefined;
    this.heartbeat_in = undefined;
    this.abort_idle = false;
    this.socket_ready = false;
    this.scheduled_reconnect = undefined;
    this.default_sender = undefined;

    for (var i in aliases) {
        var f = aliases[i];
        Object.defineProperty(this, f, { get: remote_property_shortcut(f) });
    }
    Object.defineProperty(this, 'error', { get:  function() { return this.remote.close ? this.remote.close.error : undefined; }});
};

Connection.prototype = Object.create(EventEmitter.prototype);
Connection.prototype.constructor = Connection;
Connection.prototype.dispatch = function(name) {
    log.events('Connection got event: %s', name);
    if (this.listeners(name).length) {
        EventEmitter.prototype.emit.apply(this, arguments);
        return true;
    } else if (this.container) {
        return this.container.dispatch.apply(this.container, arguments);
    } else {
        return false;
    }
};

Connection.prototype.reset = function() {
    if (this.abort_idle) {
        this.abort_idle = false;
        this.local.close.error = undefined;
        this.state = new EndpointState();
        this.state.open();
    }

    //reset transport
    this.amqp_transport = new Transport(this.options.id, AMQP_PROTOCOL_ID, frames.TYPE_AMQP, this);
    this.sasl_transport = undefined;
    this.transport = this.amqp_transport;

    //reset remote endpoint state
    this.state.disconnected();
    this.remote = {};
    //reset sessions:
    this.remote_channel_map = {};
    for (var k in this.local_channel_map) {
        this.local_channel_map[k].reset();
    }
    this.socket_ready = false;
};

Connection.prototype.connect = function () {
    this.is_server = false;
    this._connect(this.options.connection_details(this.conn_established_counter));
    this.open();
    return this;
};

Connection.prototype.reconnect = function () {
    this.scheduled_reconnect = undefined;
    log.reconnect('reconnecting...');
    this.reset();
    this._connect(this.options.connection_details(this.conn_established_counter));
    process.nextTick(this._process.bind(this));
    return this;
};

Connection.prototype._connect = function (details) {
    if (details.connect) {
        this.init(details.connect(details.port, details.host, details.options, this.connected.bind(this)));
    } else {
        this.init(get_connect_fn(details)(details.port, details.host, details.options, this.connected.bind(this)));
    }
    return this;
};

Connection.prototype.accept = function (socket) {
    this.is_server = true;
    log.io('[%s] client accepted: %s', this.id, get_socket_id(socket));
    this.socket_ready = true;
    return this.init(socket);
};

Connection.prototype.init = function (socket) {
    this.socket = socket;
    if (this.get_option('tcp_no_delay', false) && this.socket.setNoDelay) {
        this.socket.setNoDelay(true);
    }
    this.socket.on('data', this.input.bind(this));
    this.socket.on('error', this.on_error.bind(this));
    this.socket.on('end', this.eof.bind(this));

    if (this.is_server) {
        var mechs;
        if (this.container && Object.getOwnPropertyNames(this.container.sasl_server_mechanisms).length) {
            mechs = this.container.sasl_server_mechanisms;
        }
        if (this.socket.encrypted && this.socket.authorized && this.get_option('enable_sasl_external', false)) {
            mechs = sasl.server_add_external(mechs ? util.clone(mechs) : {});
        }
        if (mechs) {
            if (mechs.ANONYMOUS !== undefined && !this.get_option('require_sasl', false)) {
                this.sasl_transport = new sasl.Selective(this, mechs);
            } else {
                this.sasl_transport = new sasl.Server(this, mechs);
            }
        } else {
            if (!this.get_option('disable_sasl', false)) {
                var anon = sasl.server_mechanisms();
                anon.enable_anonymous();
                this.sasl_transport = new sasl.Selective(this, anon);
            }
        }
    } else {
        var mechanisms = this.get_option('sasl_mechanisms');
        if (!mechanisms) {
            var username = this.get_option('username');
            var password = this.get_option('password');
            var token = this.get_option('token');
            if (username) {
                mechanisms = sasl.client_mechanisms();
                if (password) mechanisms.enable_plain(username, password);
                else if (token) mechanisms.enable_xoauth2(username, token);
                else mechanisms.enable_anonymous(username);
            }
        }
        if (this.socket.encrypted && this.options.cert && this.get_option('enable_sasl_external', false)) {
            if (!mechanisms) mechanisms = sasl.client_mechanisms();
            mechanisms.enable_external();
        }

        if (mechanisms) {
            this.sasl_transport = new sasl.Client(this, mechanisms, this.options.sasl_init_hostname || this.options.servername || this.options.host);
        }
    }
    this.transport = this.sasl_transport ? this.sasl_transport : this.amqp_transport;
    return this;
};

Connection.prototype.attach_sender = function (options) {
    return this.session_policy.get_session().attach_sender(options);
};
Connection.prototype.open_sender = Connection.prototype.attach_sender;//alias

Connection.prototype.attach_receiver = function (options) {
    if (this.get_option('tcp_no_delay', true) && this.socket.setNoDelay) {
        this.socket.setNoDelay(true);
    }
    return this.session_policy.get_session().attach_receiver(options);
};
Connection.prototype.open_receiver = Connection.prototype.attach_receiver;//alias

Connection.prototype.get_option = function (name, default_value) {
    if (this.options[name] !== undefined) return this.options[name];
    else if (this.container) return this.container.get_option(name, default_value);
    else return default_value;
};

Connection.prototype.send = function(msg) {
    if (this.default_sender === undefined) {
        this.default_sender = this.open_sender({target:{}});
    }
    return this.default_sender.send(msg);
};

Connection.prototype.connected = function () {
    this.socket_ready = true;
    this.conn_established_counter++;
    log.io('[%s] connected %s', this.options.id, get_socket_id(this.socket));
    this.output();
};

Connection.prototype.sasl_failed = function (text) {
    this.transport_error = {condition:'amqp:unauthorized-access', description:text};
    this._handle_error();
};

Connection.prototype._is_fatal = function (error_condition) {
    var non_fatal = this.get_option('non_fatal_errors', ['amqp:connection:forced']);
    return non_fatal.indexOf(error_condition) < 0;
};

Connection.prototype._handle_error = function () {
    var error = this.get_error();
    if (error) {
        var handled = this.dispatch('connection_error', this._context());
        handled = this.dispatch('connection_close', this._context()) || handled;

        if (!this._is_fatal(error.condition)) {
            this.open();
        } else if (!handled) {
            this.dispatch('error', new errors.ConnectionError(error.description, error.condition, this));
        }
        return true;
    } else {
        return false;
    }
};

Connection.prototype.get_error = function () {
    if (this.transport_error) return this.transport_error;
    if (this.remote.close && this.remote.close.error) return this.remote.close.error;
    return undefined;
};

Connection.prototype._get_peer_details = function () {
    var s = '';
    if (this.remote.open && this.remote.open.container) {
        s += this.remote.open.container + ' ';
    }
    if (this.remote.open && this.remote.open.properties) {
        s += JSON.stringify(this.remote.open.properties);
    }
    return s;
};

Connection.prototype.output = function () {
    try {
        if (this.socket && this.socket_ready) {
            if (this.heartbeat_out) clearTimeout(this.heartbeat_out);
            this.transport.write(this.socket);
            if (((this.is_closed() && this.state.has_settled()) || this.abort_idle || this.transport_error) && !this.transport.has_writes_pending()) {
                this.socket.end();
            } else if (this.is_open() && this.remote.open.idle_time_out) {
                this.heartbeat_out = setTimeout(this._write_frame.bind(this), this.remote.open.idle_time_out / 2);
            }
        }
    } catch (e) {
        if (e.name === 'ProtocolError') {
            console.error('[' + this.options.id + '] error on write: ' + e + ' ' + this._get_peer_details() + ' ' + e.name);
            this.dispatch('protocol_error', e) || console.error('[' + this.options.id + '] error on write: ' + e + ' ' + this._get_peer_details());
        } else {
            this.dispatch('error', e);
        }
        this.socket.end();
    }
};

function byte_to_hex(value) {
    if (value < 16) return '0x0' + Number(value).toString(16);
    else return '0x' + Number(value).toString(16);
}

function buffer_to_hex(buffer) {
    var bytes = [];
    for (var i = 0; i < buffer.length; i++) {
        bytes.push(byte_to_hex(buffer[i]));
    }
    return bytes.join(',');
}

Connection.prototype.input = function (buff) {
    var buffer;
    try {
        if (this.heartbeat_in) clearTimeout(this.heartbeat_in);
        log.io('[%s] read %d bytes', this.options.id, buff.length);
        if (this.previous_input) {
            buffer = Buffer.concat([this.previous_input, buff], this.previous_input.length + buff.length);
            this.previous_input = null;
        } else {
            buffer = buff;
        }
        var read = this.transport.read(buffer, this);
        if (read < buffer.length) {
            this.previous_input = buffer.slice(read);
        }
        if (this.local.open.idle_time_out) this.heartbeat_in = setTimeout(this.idle.bind(this), this.local.open.idle_time_out);
        if (this.transport.has_writes_pending()) {
            this.output();
        } else if (this.is_closed() && this.state.has_settled()) {
            this.socket.end();
        } else if (this.is_open() && this.remote.open.idle_time_out && !this.heartbeat_out) {
            this.heartbeat_out = setTimeout(this._write_frame.bind(this), this.remote.open.idle_time_out / 2);
        }
    } catch (e) {
        if (e.name === 'ProtocolError') {
            this.dispatch('protocol_error', e) ||
                console.error('[' + this.options.id + '] error on read: ' + e + ' ' + this._get_peer_details() + ' (buffer:' + buffer_to_hex(buffer) + ')');
        } else {
            this.dispatch('error', e);
        }
        this.socket.end();
    }

};

Connection.prototype.idle = function () {
    if (this.is_open()) {
        this.abort_idle = true;
        this.local.close.error = {condition:'amqp:resource-limit-exceeded', description:'max idle time exceeded'};
        this.close();
    }
};

Connection.prototype.on_error = function (e) {
    var error_data = {
        type: e.type,
        message: e.message,
        error: e.error,
        readyState: (e.target !== undefined) ? e.target.readyState : undefined
    };
    this._disconnected(error_data);
};

Connection.prototype.eof = function () {
    this._disconnected();
};

Connection.prototype._disconnected = function (error) {
    if (this.heartbeat_out) clearTimeout(this.heartbeat_out);
    if (this.heartbeat_in) clearTimeout(this.heartbeat_in);
    if (!this.is_closed() && this.scheduled_reconnect === undefined) {
        var disconnect_ctxt = {};
        if (error) {
            disconnect_ctxt.error = error.error || error.message;
        }
        if (!this.is_server && !this.transport_error && this.options.reconnect) {
            var delay = this.options.reconnect(this.conn_established_counter);
            if (delay >= 0) {
                log.reconnect('Scheduled reconnect in ' + delay + 'ms');
                this.scheduled_reconnect = setTimeout(this.reconnect.bind(this), delay);
                disconnect_ctxt.reconnecting = true;
            } else {
                disconnect_ctxt.reconnecting = false;
            }
        }
        if (!this.dispatch('disconnected', this._context(disconnect_ctxt))) {
            console.warn('[' + this.options.id + '] disconnected %s', disconnect_ctxt.error || '');
        }
    }
};

Connection.prototype.open = function () {
    if (this.state.open()) {
        this._register();
    }
};

Connection.prototype.close = function (error) {
    if (error) this.local.close.error = error;
    if (this.state.close()) {
        this._register();
    }
};

Connection.prototype.is_open = function () {
    return this.state.is_open();
};

Connection.prototype.is_remote_open = function () {
    return this.state.remote_open;
};

Connection.prototype.is_closed = function () {
    return this.state.is_closed();
};

Connection.prototype.create_session = function () {
    var i = 0;
    while (this.local_channel_map[i]) i++;
    var session = new Session(this, i);
    this.local_channel_map[i] = session;
    return session;
};

Connection.prototype.find_sender = function (filter) {
    return this.find_link(util.sender_filter(filter));
};

Connection.prototype.find_receiver = function (filter) {
    return this.find_link(util.receiver_filter(filter));
};

Connection.prototype.find_link = function (filter) {
    for (var channel in this.local_channel_map) {
        var session = this.local_channel_map[channel];
        var result = session.find_link(filter);
        if (result) return result;
    }
    return undefined;
};

Connection.prototype.each_receiver = function (action, filter) {
    this.each_link(action, util.receiver_filter(filter));
};

Connection.prototype.each_sender = function (action, filter) {
    this.each_link(action, util.sender_filter(filter));
};

Connection.prototype.each_link = function (action, filter) {
    for (var channel in this.local_channel_map) {
        var session = this.local_channel_map[channel];
        session.each_link(action, filter);
    }
};

Connection.prototype.on_open = function (frame) {
    if (this.state.remote_opened()) {
        this.remote.open = frame.performative;
        this.open();
        this.dispatch('connection_open', this._context());
    } else {
        throw new errors.ProtocolError('Open already received');
    }
};

Connection.prototype.on_close = function (frame) {
    if (this.state.remote_closed()) {
        this.remote.close = frame.performative;
        this.close();
        if (this.remote.close.error) {
            this._handle_error();
        } else {
            this.dispatch('connection_close', this._context());
        }
        if (this.heartbeat_out) clearTimeout(this.heartbeat_out);
    } else {
        throw new errors.ProtocolError('Close already received');
    }
};

Connection.prototype._register = function () {
    if (!this.registered) {
        this.registered = true;
        process.nextTick(this._process.bind(this));
    }
};

Connection.prototype._process = function () {
    this.registered = false;
    do {
        if (this.state.need_open()) {
            this._write_open();
        }
        for (var k in this.local_channel_map) {
            this.local_channel_map[k]._process();
        }
        if (this.state.need_close()) {
            this._write_close();
        }
    } while (!this.state.has_settled());
};

Connection.prototype._write_frame = function (channel, frame, payload) {
    this.amqp_transport.encode(frames.amqp_frame(channel, frame, payload));
    this.output();
};

Connection.prototype._write_open = function () {
    this._write_frame(0, this.local.open.described());
};

Connection.prototype._write_close = function () {
    this._write_frame(0, this.local.close.described());
};

Connection.prototype.on_begin = function (frame) {
    var session;
    if (frame.performative.remote_channel === null || frame.performative.remote_channel === undefined) {
        //peer initiated
        session = this.create_session();
        session.local.begin.remote_channel = frame.channel;
    } else {
        session = this.local_channel_map[frame.performative.remote_channel];
        if (!session) throw new errors.ProtocolError('Invalid value for remote channel ' + frame.performative.remote_channel);
    }
    session.on_begin(frame);
    this.remote_channel_map[frame.channel] = session;
};

Connection.prototype.get_peer_certificate = function() {
    if (this.socket && this.socket.getPeerCertificate) {
        return this.socket.getPeerCertificate();
    } else {
        return undefined;
    }
};

Connection.prototype.get_tls_socket = function() {
    if (this.socket && (this.options.transport === 'tls' || this.options.transport === 'ssl')) {
        return this.socket;
    } else {
        return undefined;
    }
};

Connection.prototype._context = function (c) {
    var context = c ? c : {};
    context.connection = this;
    if (this.container) context.container = this.container;
    return context;
};

Connection.prototype.remove_session = function (session) {
    delete this.remote_channel_map[session.remote.channel];
    delete this.local_channel_map[session.local.channel];
};

function delegate_to_session(name) {
    Connection.prototype['on_' + name] = function (frame) {
        var session = this.remote_channel_map[frame.channel];
        if (!session) {
            throw new errors.ProtocolError(name + ' received on invalid channel ' + frame.channel);
        }
        session['on_' + name](frame);
    };
}

delegate_to_session('end');
delegate_to_session('attach');
delegate_to_session('detach');
delegate_to_session('transfer');
delegate_to_session('disposition');
delegate_to_session('flow');

module.exports = Connection;
