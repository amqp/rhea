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
let container = require('rhea');

const abc = require('./tracing').client

var args = require('../options.js').options({
    'n': { alias: 'node', default: 'examples', describe: 'name of node (e.g. queue) to which messages are sent'},
    'h': { alias: 'host', default: 'localhost', describe: 'dns or ip name of server where you want to connect'},
    'p': { alias: 'port', default: 5672, describe: 'port to connect to'}
}).help('help').argv;


var requests = [
    'Twas brillig, and the slithy toves',
    'Did gire and gymble in the wabe.',
    'All mimsy were the borogroves,',
    'And the mome raths outgrabe.'
];


const clientObj = new abc(`${args.host}:${args.port}/${args.node}`, requests, args, "tracerObj", 'client', 'client-requests');

container.connect({port: args.port, host: args.hos, tracing: true});


container.on('connection_close',()=>{
    clientObj.tracerObj.finish();
    console.log("all done")
});
