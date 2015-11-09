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
      'm': { alias: 'messages', default: 100, describe: 'number of messages to send'},
      'n': { alias: 'node', default: 'examples', describe: 'name of node (e.g. queue) to which messages are sent'},
      'p': { alias: 'port', default: 5672, describe: 'port to connect to'}
    }).help('help').argv;

var confirmed = 0, sent = 0;
var total = args.messages;

container.on('sendable', function (context) {
    while (context.sender.sendable() && sent < total) {
        sent++;
        console.log('sent ' + sent);
        context.sender.send({properties:{id:sent}, body:{'sequence':sent}})
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

container.connect({'port':args.port}).attach_sender(args.node);
