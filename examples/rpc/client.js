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
//a client through which requests can be invoked can be created via
//the container:
var client = container.rpc_client('amqp://localhost:5672/examples');
//to make a request, the call() method can be used directly, passing
//in the name, the arguments (as a single object) and a callback
//through which to be notified of the result:
client.call('fib', {'n':5}, function(result) { console.log('fib(5) => ' + result); });
//alternatively you can define a named function on the client:
client.define('fib');
//and then call that function, passing in arguments (again as a single
//object) and a callback:
client.fib({'n':10}, function(result) { console.log('fib(10) => ' + result); client.close(); });
//(when the client is no longer needed, it can be closed)

