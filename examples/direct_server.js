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
      'p': { alias: 'port', default: 5672, describe: 'port to connect to'}
    }).help('help').argv;

//container.sasl_server_mechanisms.enable_anonymous();
var server = container.listen({'port':args.port});

container.on('receiver_open', function (context) {
    context.receiver.set_target({address:context.receiver.remote.attach.target.address});
});

container.on('sender_open', function (context) {
    if (context.sender.source.dynamic) {
        var id = container.generate_uuid();
        context.sender.set_source({address:id});
    }
});

function match_source_address(link, address) {
    return link && link.local && link.local.attach && link.local.attach.source
        && link.local.attach.source.address === address;
}

container.on('message', function (context) {
    var request = context.message;
    var reply_to = request.properties.reply_to;
    var response = {to: reply_to};
    console.log("Received: " + request.body);
    if (request.properties.correlation_id) {
        response.correlation_id = request.properties.correlation_id;
    }
    var upper = request.body.toString().toUpperCase();
    response.body = upper;
    var o = context.connection.find_sender(function (s) { return match_source_address(s, reply_to); });
    if (o) {
        o.send(response);
    }
});
