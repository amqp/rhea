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

var received = 0;
var expected = args.messages;

container.on('message', function (context) {
    if (expected === 0 || received < expected) {
        console.log(JSON.stringify(context.message.body))
        if (++received === expected) {
            context.receiver.detach();
            context.connection.close();
        }
    }
});

container.connect({'port':args.port}).open_receiver({source:{address:args.node,distribution_mode:'copy'}});
