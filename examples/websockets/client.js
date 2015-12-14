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
var client = require('rhea');
var WebSocket = require('ws');
var ws = client.websocket_connect(WebSocket);

var args = require('yargs').options({
      'm': { alias: 'messages', default: 100, describe: 'number of messages to send'},
      'u': { alias: 'url', default: 'ws://localhost:5673', describe: 'url to connect to'}
    }).help('help').argv;

var requests = args.messages;
var current = 1;
var sender;

function next_request() {
    var msg = 'request-' + current;
    sender.send({body:msg})
    console.log('sent ' + msg);
}

client.on('connection_open', function (context) {
    next_request();
});

client.on('message', function (context) {
    console.log('received ' + context.message.body);
    if (current++ < requests) {
        next_request();
    } else {
        context.connection.close();
    }
});

var connection = client.connect({connection_details:ws(args.url)});
sender = connection.open_sender('examples');
connection.open_receiver('examples');


