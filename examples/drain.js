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
      'n': { alias: 'node', default: 'examples', describe: 'name of node (e.g. queue) from which messages are received'},
      'p': { alias: 'port', default: 5672, describe: 'port to connect to'}
    }).help('help').argv;

var batch = 10;
var received = 0;

container.on('message', function (context) {
    console.log(JSON.stringify(context.message.body))
    if (++received === batch) {
        received = 0;
        context.receiver.add_credit(batch);
    }
});

container.on('receiver_open', function (context) {
    context.receiver.flow(batch);
    context.receiver.drain = true;
});

container.on('receiver_drained', function (context) {
    context.receiver.detach();
    context.connection.close();
});

container.connect({'port':args.port}).open_receiver({source:{address:args.node},credit_window:0/*disable automatic credit*/});
