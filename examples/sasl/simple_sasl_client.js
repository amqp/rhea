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
      'username': { describe: 'username to connect with'},
      'password': { describe: 'password to connect with (will use PLAIN)'},
      'p': { alias: 'port', default: 5671, describe: 'port to connect to'}
    }).help('help').argv;

/**
 * Default SASL behaviour is as follows. If the username and password
 * are both specified, PLAIN will be used. If only a username is
 * specified, ANONYMOUS will be used. If neither is specified, no SASl
 * layer will be used.
 */
if (args.username) {
    container.options.username = args.username;
}
if (args.password) {
    container.options.password = args.password;
}
container.on('connection_open', function (context) {
    console.log('Connected!');
    context.connection.close();
});
container.connect({'port':args.port});
