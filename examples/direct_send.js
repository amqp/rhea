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

var args = require('./options.js').options({
      'm': { alias: 'messages', default: 100, describe: 'number of messages to send'},
      'p': { alias: 'port', default: 8888, describe: 'port to connect to'}
    }).help('help').argv;

var server = container.listen({'port':args.port});

var confirmed = 0, sent = 0;
var total = args.messages;

container.on('sendable', function (context) {
    while (context.sender.sendable() && sent < total) {
        sent++;
        console.log('sent ' + sent);
        context.sender.send({id:sent, body:{'sequence':sent}})
    }
    if (sent === total) {
        context.sender.set_drained(sent === total);
    }
});
container.on('accepted', function (context) {
    if (++confirmed === total) {
        console.log("all messages confirmed")
    }
});
container.on('disconnected', function (context) {
    sent = confirmed;
});
