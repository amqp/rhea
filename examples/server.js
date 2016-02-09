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

var relay;
var senders = {};

container.on('connection_open', function (context) {
    context.connection.attach_receiver('examples');
});

container.on('message', function (context) {
    var request = context.message;
    var reply_to = request.properties.reply_to;
    console.log("Received: " + request.body);
    var response = {properties:{to: reply_to}, body: request.body.toString().toUpperCase()};
    if (request.properties.correlation_id) {
        response.correlation_id = request.properties.correlation_id;
    }
    context.connection.send(response);
});

container.connect({'port':5672});
