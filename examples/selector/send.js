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

var args = require('yargs').options({
      'n': { alias: 'node', default: 'examples', describe: 'name of node (e.g. queue or topic) to which messages are sent'},
      'p': { alias: 'port', default: 5672, describe: 'port to connect to'}
    }).usage('Usage: $0 [options] <messages>').help('help').argv;

var connection = require('rhea').connect({'port':args.port});
var sender = connection.open_sender(args.node);
var messages;
if (args._.length > 0) {
    messages = args._.map(JSON.parse);
} else {
    messages = [{application_properties:{colour:'red'},body:'panda'},
                {application_properties:{colour:'green'},body:'grasshopper'},
                {application_properties:{colour:'red'},body:'squirrel'},
                {application_properties:{colour:'blue'},body:'whale'}];
}
sender.on('sendable', function(context) {
    for (var i = 0; i < messages.length; i++) {
        var m = messages[i];
        console.log('sent ' + m.application_properties.colour + '-' + m.body);
        sender.send(m);
    }
    connection.close();
});
