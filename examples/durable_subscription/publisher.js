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
var args = require('minimist')(process.argv.slice(2),
    {
        string: ['topic'],
        number: ['port'],
        alias: { t: 'topic', p: 'port' },
        default: { topic: "topic://PRICE.STOCK.NYSE.RHT", port: 5672 },
    }
);

var connection = require('rhea').connect({'port':args.port});
var sender = connection.open_sender(args.topic);
sender.on('sendable', function(context) {
    for (var i = 0; i < args._.length; i++) {
        var m = args._[i];
        console.log('sent ' + m);
        sender.send({body:m});
    }
    connection.close();
});
