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
'use strict';

var assert = require('assert');
var rhea = require('rhea');
var fs = require('fs');
var path = require('path');


describe('ssl', function() {
    this.slow(200);
    var listener;

    afterEach(function() {
        if (listener) listener.close();
    });

    function success(server_conf, client_conf) {
        return function(done) {
            var container = server_conf.container || rhea.create_container();

            container.on('connection_open', function (context) {
                if (server_conf.verification) server_conf.verification(context);
            });
            var server_options = server_conf.options || {};
            server_options.port = 0;
            if (server_options.transport === undefined) server_options.transport = 'tls';
            if (server_options.key === undefined) server_options.key = fs.readFileSync(path.resolve(__dirname,'server-key.pem'));
            if (server_options.cert === undefined) server_options.cert = fs.readFileSync(path.resolve(__dirname,'server-cert.pem'));
            if (server_options.ca === undefined) server_options.ca = fs.readFileSync(path.resolve(__dirname,'ca-cert.pem'));
            listener = container.listen(server_options);
            listener.on('listening', function() {
                var client = client_conf.container || rhea.create_container();
                var client_options = client_conf.options || {};
                client_options.port = listener.address().port;
                if (client_options.transport === undefined) client_options.transport = 'tls';
                if (client_options.key === undefined) client_options.key = fs.readFileSync(path.resolve(__dirname,'client-key.pem'));
                if (client_options.cert === undefined) client_options.cert = fs.readFileSync(path.resolve(__dirname,'client-cert.pem'));
                if (client_options.ca === undefined) client_options.ca = fs.readFileSync(path.resolve(__dirname,'ca-cert.pem'));

                var conn = client.connect(client_options);
                conn.on('connection_open', function(context) {
                    if (client_conf.verification) client_conf.verification(context);
                    context.connection.close();
                    done();
                });
                conn.on('connection_error', function(context) {
                    assert.ok(false, 'Error: ' + JSON.stringify(context.connection.get_error()));
                    done();
                });
                conn.on('disconnected', function(context) {
                    assert.ok(false, 'disconnected: ' + JSON.stringify(context.connection.get_error()));
                    done();
                });
            });
        };
    }

    function get_container_for_sasl_plain() {
        var container = rhea.create_container();
        container.sasl_server_mechanisms.enable_plain(
            function(username, password) {
                return username.split("").reverse().join("") === password;
            }
        );
        return container;
    }

    it('simple tls', success({}, {}));
    it('simple ssl', success({options:{transport:'ssl'}}, {options:{transport:'ssl'}}));//test 'ssl' as simple alias for 'tls'
    it('client auth and external',
       success(
           {
               options:{enable_sasl_external:true, requestCert: true},
               verification:function (context) {
                   assert.equal(context.connection.get_peer_certificate().subject.CN, 'TestClient');
               },
           },
           {
               options:{enable_sasl_external:true}
           }
       )
      );
    it('client auth and plain',
       success(
           {
               options:{enable_sasl_external:true, requestCert: true},
               //verification:function (context) {
               //    assert.equal(context.connection.get_peer_certificate().subject.CN, 'TestClient');
               //},
               container: get_container_for_sasl_plain()
           },
           {
               options:{username:'bob', password:'bob'}
           }
       )
      );

});
