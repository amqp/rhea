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
var container = require('rhea');

var args = require('yargs').options({
      'm': { alias: 'messages', default: 0, describe: 'number of messages to expect'},
      'p': { alias: 'port', default: 8888, describe: 'port to listen on'}
    }).help('help').argv;

var received = 0;
var expected = args.messages;
var listeners = {};

var WebSocketServer = require('ws').Server;
var server = WebSocketServer({'port':args.port});
server.on('connection', function (ws) {
    console.log('Accepted incoming websocket connection');
    container.websocket_accept(ws);
});

function subscribe(name, sender) {
    listeners[name] = sender;
}

function unsubscribe(name) {
    delete listeners[name];
}

container.on('sender_open', function (context) {
    subscribe(context.connection.remote.open.container_id, context.sender);
});
container.on('sender_close', function (context) {
    unsubscribe(context.connection.remote.open.container_id);
});
container.on('connection_close', function (context) {
    unsubscribe(context.connection.remote.open.container_id);
});
container.on('disconnected', function (context) {
    unsubscribe(context.connection.remote.open.container_id);
});

container.on('message', function (context) {
    if (expected === 0 || received < expected) {
        var name = context.connection.remote.open.container_id;
        console.log('echoed ' + context.message.body + ' to ' + name);
        listeners[name].send(context.message);
        if (++received === expected) {
            context.receiver.detach();
            context.connection.close();
        }
    }
});
