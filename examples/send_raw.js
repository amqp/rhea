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
var amqp_message = container.message;

var args = require('./options.js').options({
    'm': { alias: 'messages', default: 100, describe: 'number of messages to send'},
    'n': { alias: 'node', default: 'examples', describe: 'name of node (e.g. queue) to which messages are sent'},
    'h': { alias: 'host', default: 'localhost', describe: 'dns or ip name of server where you want to connect'},
    'p': { alias: 'port', default: 5672, describe: 'port to connect to'}
}).help('help').argv;

var confirmed = 0, sent = 0;
var total = args.messages;

container.on('sendable', function (context) {
    while (context.sender.sendable() && sent < total) {
        sent++;
        console.log('sent ' + sent);
        var stringifiedPayload = JSON.stringify({'sequence':sent});
        // In this example, we are sending a byte array containing ascii 
        // characters though this can be any opaque binary payload
        var body = amqp_message.data_section(new Buffer(stringifiedPayload, 'utf8'));
        context.sender.send({message_id:sent, body});
    }
});
container.on('accepted', function (context) {
    if (++confirmed === total) {
        console.log('all messages confirmed');
        context.connection.close();
    }
});
container.on('disconnected', function (context) {
    if (context.error) console.error('%s %j', context.error, context.error);
    sent = confirmed;
});

container.connect({port: args.port, host: args.host}).open_sender(args.node);
