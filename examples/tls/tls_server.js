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
var fs = require('fs');
var path = require('path');
var args = require('minimist')(process.argv.slice(2),
    {
        number: ['port'],
        alias: { p: 'port' },
        default: { port: 5671 },
    }
);

container.on('connection_open', function (context) {
    var cert = context.connection.get_peer_certificate();
    var cn;
    if (cert && cert.subject) cn = cert.subject.CN;
    var tls = context.connection.get_tls_socket();
    var servername;
    if (tls && tls.servername) servername = tls.servername;
    console.log('Connected: ' + cn + ((tls && tls.servername) ? ' [' + tls.servername + ']' : ''));
});
var listener = container.listen({port:args.port, transport:'tls',
                  //enable_sasl_external:true,
                  key: fs.readFileSync(path.resolve(__dirname, 'server-key.pem')),
                  cert: fs.readFileSync(path.resolve(__dirname,'server-cert.pem')),

                  // to require client authentication:
                  requestCert: true,
                  rejectUnauthorized: true,
                  ca: [ fs.readFileSync(path.resolve(__dirname,'ca-cert.pem')) ]
                 });
listener.on('clientError', function (error, socket) {
    console.log(error);
});

