#!/usr/bin/env node
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

var args = require('yargs').options({
      'client': { default: 'my-client', describe: 'name of identifier for client container'},
      'subscription': { default: 'my-subscription', describe: 'name of identifier for subscription'},
      't': { alias: 'topic', default: 'topic://PRICE.STOCK.NYSE.*', describe: 'name of topic to subscribe to'},
      'p': { alias: 'port', default: 5672, describe: 'port to connect to'}
    }).help('help').argv;

var connection = require("rhea").connect({port:args.port, container_id:args.client});
connection.on('message', function (context) {
    if (context.message.body === 'detach') {
        // detaching leaves the subscription active, so messages sent
        // while detached are kept until we attach again
        context.receiver.detach();
        context.connection.close();
    } else if (context.message.body === 'close') {
        // closing cancels the subscription
        context.receiver.close();
        context.connection.close();
    } else {
        console.log(context.message.body);
    }
});
// the identity of the subscriber is the combination of container id
// and link (i.e. receiver) name
connection.open_receiver({name:args.subscription, source:{address:args.topic, durable:2, expiry_policy:'never'}});
