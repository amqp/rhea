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

var Connection = require('./connection.js');
var log = require('./log.js');
var sasl = require('./sasl.js');
var util = require('./util.js');

var net = require("net");
var url = require("url");
var EventEmitter = require('events').EventEmitter;

var Container = function (options) {
    this.options = options ? Object.create(options) : {};
    if (!this.options.id) {
        this.options.id = util.generate_uuid();
    }
    this.id = this.options.id;
    this.sasl_server_mechanisms = sasl.server_mechanisms();
};

Container.prototype = Object.create(EventEmitter.prototype);
Container.prototype.constructor = Container;
Container.prototype.dispatch = function(name, context) {
    log.events('Container got event: ' + name);
    EventEmitter.prototype.emit.apply(this, arguments);
};

Container.prototype.connect = function (options) {
    return new Connection(options, this).connect();
}
Container.prototype.listen = function (options) {
    var server = net.createServer();
    var container = this;
    server.on('connection', function (socket) {
        new Connection(options, container).accept(socket);
    });
    if (process.version.match(/v0\.10\.(\d+)/)) {
        server.listen(options.port);
    } else {
        server.listen(options);
    }
    return server;
};
Container.prototype.create_container = function (options) {
    return new Container(options);
}
Container.prototype.get_option = function (name, default_value) {
    if (this.options[name] !== undefined) return this.options[name];
    else return default_value;
};
Container.prototype.generate_uuid = util.generate_uuid;

module.exports = new Container();
