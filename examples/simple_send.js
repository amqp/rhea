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

var args = require('minimist')(process.argv.slice(2),
    {
        string: ['node'],
        number: ['messages', 'port'],
        alias: { m: 'messages', n: 'node', p: 'port' },
        default: { node: "examples", port: 5672, messages: 100 },
    }
);

var confirmed = 0, sent = 0;
var total = args.messages;

container.on('sendable', function (context) {
    while (context.sender.sendable() && sent < total) {
        sent++;
        console.log('sent ' + sent);
        context.sender.send({message_id:sent, body:{'sequence':sent}})
    }
});
container.on('accepted', function (context) {
    if (++confirmed === total) {
        console.log("all messages confirmed")
        context.connection.close()
    }
});
container.on('disconnected', function (context) {
    sent = confirmed;
});

container.connect({'port':args.port}).open_sender(args.node);
