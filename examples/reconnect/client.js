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
      'request_interval': {describe: 'interval between requests', default:1000},
      'fixed_delay': {describe: 'fixed reconnect delay'},
      'initial_delay': {describe: 'initial reconnect delay'},
      'max_delay': {describe: 'max reconnect delay'},
      'reconnect_limit': {describe: 'maximum number of reconnect attempts'},
      'disable_reconnect': {type:'boolean', describe: 'disable reconnect'},
      'idle_time_out': {describe: 'maximum idle timeout; if nothing is received from peer for this interval, consider connection dead'},
      'm': { alias: 'messages', default: 100, describe: 'number of messages to send'},
      'p': { alias: 'ports', default: [8888], type: 'array', describe: 'port to connect to'}
    }).help('help').argv;

var requests = args.messages;
var current = 1;
var sender;
var timer_task;

var attempt = 0;
var connect_options = {
    //A function can be specified as the value for a
    //connection_details property on the options passed to
    //connect(). This should return an object defining the connection
    //options to use. Here we use it to alternate between the
    //different ports supplied via command line arguments.
    connection_details: function() {
        return {port:args.ports[attempt++ % args.ports.length]}
    }
};
if (args.disable_reconnect) {
    //By default, reconnect is enabled. It can be disabled by setting
    //the connection (or container) option 'reconnect' to false.
    connect_options.reconnect = false;
} else {
    if (args.fixed_delay) {
        //If reconnect is set to a numeric value, that is assumed to
        //be the desired fixed delay in miilisecs between retries.
        connect_options.reconnect = args.fixed_delay;
    } else {
        //The default reconnect behaviour uses a backoff strategy,
        //whereby it starts with an initial delay and then doubles it
        //after every unsuccessful attempt, up to a defined maximum
        //delay. The initial and maximum values can be specified by
        //the application if desired.
        if (args.initial_delay) connect_options.initial_reconnect_delay = args.initial_delay;
        if (args.max_delay) connect_options.max_reconnect_delay = args.max_delay;
    }
    //The reconnect_limit option allows the number of reconnect
    //attempts to be limited.
    if (args.reconnect_limit) connect_options.reconnect_limit = args.reconnect_limit;
}

if (args.idle_time_out) {
    connect_options.idle_time_out=args.idle_time_out;
}

function next_request() {
    var msg = 'request-' + current;
    sender.send({body:msg})
    console.log('sent ' + msg);
}

container.on('connection_open', function (context) {
    next_request();
});

container.on('message', function (context) {
    console.log('received ' + context.message.body);
    if (current++ < requests) {
        timer_task = setTimeout(next_request, args.request_interval);
    } else {
        sender = undefined;
        if (timer_task) clearTimeout(timer_task);
        context.connection.close();
        console.log('connection closed');
    }
});

var connection = container.connect(connect_options);
sender = connection.attach_sender('examples');
connection.attach_receiver('examples');
