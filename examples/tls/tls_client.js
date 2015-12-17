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
var args = require('yargs').options({
      'p': { alias: 'port', default: 5671, describe: 'port to connect to'}
    }).help('help').argv;


container.on('connection_open', function (context) {
    console.log('Connected!');
    context.connection.close();
});
container.connect({port:args.port, transport:'tls',
                   //enable_sasl_external:true,
                   // These are necessary only if using the client certificate authentication
                   key: fs.readFileSync(path.resolve(__dirname,'client-key.pem')),
                   cert: fs.readFileSync(path.resolve(__dirname,'client-cert.pem')),

                   // This is necessary only if the server uses the self-signed certificate
                   ca: [ fs.readFileSync(path.resolve(__dirname,'ca-cert.pem')) ]
                  });
