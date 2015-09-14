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

var frames = require('./frames.js');
var log = require('./log.js');
var sasl = require('./sasl.js');
var types = require('./types.js');
var util = require('./util.js');
var EndpointState = require('./endpoint.js');
var Session = require('./session.js');
var Transport = require('./transport.js');

var net = require("net");
var tls = require("tls");
var EventEmitter = require('events').EventEmitter;

var AMQP_PROTOCOL_ID = 0x00;
var TLS_PROTOCOL_ID = 0x02;

function get_socket_id(socket) {
    return socket.localAddress + ':' + socket.localPort + ' -> ' + socket.remoteAddress + ':' + socket.remotePort;
};

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
};

var conn_counter = 1;

var Connection = function (options, container) {
    this.options = {};
    if (options) {
        for (var k in options) {
            this.options[k] = options[k];
        }
    }
    this.container = container;
    if (!this.options.id) {
        this.options.id = 'connection-' + conn_counter++;
    }
    if (!container && !this.options.container_id) {
        this.options.container_id = util.generate_uuid();
    }
    this.registered = false;
    this.state = new EndpointState();
    this.local_channel_map = {};
    this.remote_channel_map = {};
    this.local = {};
    this.remote = {};
    this.local.open = frames.open({'container_id': container ? container.id : this.options.container_id});
    this.local.close = frames.close({});
    this.session_policy = session_per_connection(this);
    this.amqp_transport = new Transport(this.options.id, AMQP_PROTOCOL_ID, frames.TYPE_AMQP, this);
    this.sasl_transport = undefined;
    this.transport = this.amqp_transport;
};

Connection.prototype = Object.create(EventEmitter.prototype);
Connection.prototype.constructor = Connection;
Connection.prototype.dispatch = function(name, context) {
    log.events('Connection got event: ' + name);
    if (this.listeners(name).length) {
        EventEmitter.prototype.emit.apply(this, arguments);
    } else if (this.container) {
        this.container.dispatch.apply(this.container, arguments);
    }
};

Connection.prototype.connect = function () {
    var transport;
    if (this.options.transport === undefined || this.options.transport === 'tcp') {
        transport = net;
    } else if (this.options.transport === 'tls' || this.options.transport === 'ssl') {
        transport = tls;
    }
    var host = this.options.host ? this.options.host : 'localhost';
    var port = this.options.port ? this.options.port : 5672;
    return this.init(transport.connect(port, host, this.options, this.connected.bind(this)), false);
};

Connection.prototype.accept = function (socket) {
    log.io('[' + this.id + '] client accepted: '+ get_socket_id(socket));
    return this.init(socket, true);
};

Connection.prototype.init = function (socket, is_server) {
    this.socket = socket;
    this.socket.on('data', this.input.bind(this));
    this.socket.on('error', this.error.bind(this));
    this.socket.on('end', this.eof.bind(this));

    if (is_server) {
        if (this.container && Object.getOwnPropertyNames(this.container.sasl_server_mechanisms).length) {
            this.sasl_transport = new sasl.Server(this.amqp_transport, this.container.sasl_server_mechanisms);
        }
    } else {
        var mechanisms = this.get_option('sasl_mechanisms');
        if (!mechanisms) {
            var username = this.get_option('username');
            var password = this.get_option('password');
            if (username) {
                mechanisms = sasl.client_mechanisms();
                if (password) mechanisms.enable_plain(username, password);
                else mechanisms.enable_anonymous(username);
            }
        }
        if (mechanisms) {
            this.sasl_transport = new sasl.Client(this.amqp_transport, mechanisms);
        }
    }
    this.transport = this.sasl_transport ? this.sasl_transport : this.amqp_transport;

    this.open();
    return this;
};

Connection.prototype.attach_sender = function (options) {
    return this.session_policy.get_session().attach_sender(options);
};

Connection.prototype.attach_receiver = function (options) {
    return this.session_policy.get_session().attach_receiver(options);
};

Connection.prototype.get_option = function (name, default_value) {
    if (this.options[name] !== undefined) return this.options[name];
    else if (this.container) return this.container.get_option(name, default_value);
    else return default_value;
};

Connection.prototype.connected = function () {
    log.io('[' + this.options.id + '] connected ' + get_socket_id(this.socket));
};

Connection.prototype.output = function () {
    if (this.socket) {
        this.transport.write(this.socket);
        if (this.is_closed() && this.state.has_settled() && !this.transport.has_writes_pending()) {
            this.socket.end();
        }
    }
};

Connection.prototype.input = function (buff) {
    log.io('[' + this.options.id + '] read ' + buff.length + ' bytes');
    var buffer;
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
    this.output();
};

Connection.prototype.error = function (e) {
    console.log('[' + this.options.id + '] error: ' + e);
};

Connection.prototype.eof = function () {
    if (!this.is_closed()) {
        console.log('[' + this.options.id + '] disconnected');
    }
};

Connection.prototype.open = function () {
    if (this.state.open()) {
        this._register();
    }
};
Connection.prototype.close = function () {
    if (this.state.close()) {
        this._register();
    }
};

Connection.prototype.is_open = function () {
    return this.state.is_open();
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
}

Connection.prototype.on_open = function (frame) {
    if (this.state.remote_opened()) {
        this.remote.open = frame.performative;
        this.open();
        this.dispatch('connection_open', this._context());
    } else {
        throw Error('Open already received');
    }
};

Connection.prototype.on_close = function (frame) {
    if (this.state.remote_closed()) {
        this.remote.close = frame.performative;
        this.close();
        this.dispatch('connection_close', this._context());
    } else {
        throw Error('Close already received');
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
        if (!session) throw Error('Invalid value for remote channel ' + frame.performative.remote_channel);
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

Connection.prototype._context = function (c) {
    var context = c ? c : {};
    context.connection = this;
    if (this.container) context.container = this.container;
    return context;
};

function delegate_to_session(name) {
    Connection.prototype['on_' + name] = function (frame) {
        var session = this.remote_channel_map[frame.channel];
        if (!session) {
            throw Error(name + ' received on invalid channel ' + frame.channel);
        }
        session['on_' + name](frame);
    };
};

delegate_to_session('end');
delegate_to_session('attach');
delegate_to_session('detach');
delegate_to_session('transfer');
delegate_to_session('disposition');
delegate_to_session('flow');

module.exports = Connection
