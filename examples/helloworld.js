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
container.on('connection_open', function (context) {
    context.connection.open_receiver('examples');
    context.connection.open_sender('examples');
});
container.on('message', function (context) {
    console.log(context.message.body);
    context.connection.close();
});
container.on('sendable', function (context) {
    context.sender.send({body:'Hello World!'});
    context.sender.detach();
});
//container.connect({'port':5672});
container.connect({'host':'messaging-enmasse.34.210.100.115.nip.io','port':443, transport:'tls',
                   servername:'messaging-enmasse.34.210.100.115.nip.io',rejectUnauthorized:false});
