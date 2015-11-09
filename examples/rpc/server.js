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

var cache = [0, 1];
function fib(n) {
    if (n >= cache.length) {
        for(var i = 2; i <= n; i++) {
            cache[i] = cache[i-2] + cache[i-1];
        }
    }
    return cache[n];
}

var server = container.rpc_server('amqp://localhost:5672/examples');

server.bind_sync(fib);

var map = {};
function put(args, callback) {
    map[args.key] = args.value;
    callback();
}

function get(key, callback) {
    callback(map[key]);
}

server.bind(put);
server.bind(get);
