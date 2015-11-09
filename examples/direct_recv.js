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
      'm': { alias: 'messages', default: 100, describe: 'number of messages to expect'},
      'p': { alias: 'port', default: 8888, describe: 'port to connect to'}
    }).help('help').argv;

var received = 0;
var expected = args.messages;

var server = container.listen({'port':args.port});

container.on('message', function (context) {
    if (context.message.properties && context.message.properties.id && context.message.properties.id < received) {
        // ignore duplicate message
        return;
    }
    if (expected === 0 || received < expected) {
        console.log(context.message.body)
        if (++received === expected) {
            context.receiver.detach();
            context.connection.close();
            server.close();
        }
    }
});
