/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
 */
var container = require('rhea');

var server = container.rpc_server('amqp://localhost:5672/examples');

var cache = [0, 1];
function fib(args) {
    if (args.n >= cache.length) {
        for(var i = 2; i <= args.n; i++) {
            cache[i] = cache[i-2] + cache[i-1];
        }
    }
    return cache[args.n];
}

server.bind_sync(fib);
