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
var child_process = require('child_process');
var path = require('path');
var rhea = require('rhea');

function Expectations(done) {
    this.expectations = [];
    this.size = 0;
    this.done = done;
};
Expectations.prototype.complete = function(i) {
    this.expectations[i] = true;
    if (this.expectations.every(function(o) {return o;})) {
        this.done();
    }
}
Expectations.prototype.next = function() {
    var i = this.size++;
    this.expectations[i] = false;
    var obj = this;
    return function () {
        obj.complete(i);
    };
}

function Program(name, args) {
    this.name = name;
    this.args = args || [];
    this.expected_output = undefined;
    this.actual_output = "";
    this.stopped = false;
    this.restart = false;
    this.verifier = undefined;
};

Program.prototype.produces = function(text) {
    this.expected_output = text;
    return this;
};

Program.prototype.run = function(done) {
    var prog = this;
    var name = this.name;
    var p = child_process.fork(path.resolve(__dirname, this.name), this.args, {silent:true});
    p.stdout.on('data', function (data) {
        prog.actual_output += data;
    });
    p.stderr.on('data', function (data) {
        console.log('stderr[' + name + ']: ' + data);
    });
    p.on('exit', function (code, signal) {
        prog.process = undefined;
        if (prog.restart && !prog.stopped) {
            prog.run(done);
        } else {
            if (signal === null) assert.equal(code, 0);
            if (prog.verifier) {
                prog.verifier(prog.actual_output);
            } else if (prog.expected_output) {
                assert.equal(prog.actual_output, prog.expected_output);
            }
            done();
        }
    });
    this.process = p;
};

Program.prototype.stop = function() {
    this.stopped = true;
    this.kill();
}

Program.prototype.kill = function() {
    if (this.process) {
        this.process.kill();
    }
};

function example(example, args) {
    return new Program(example, args);
}

function verify(done, programs) {
    var expectations = new Expectations(done);
    programs.map(function (p) {
        var completion_fn = expectations.next();
        return function () {
            p.run(completion_fn);
        }
    } ).forEach(function (f) { f(); } );
}

function while_running(done, background) {
    var expectations = new Expectations(done);
    var running = background.map(function (p) {
        var fn = expectations.next();
        return {
            start: function () {
                p.run(fn);
            },
            stop: function () {
                p.stop();
            }
        }
    } );
    running.forEach(function (o) { o.start(); } );
    var foreground_done = function () {
        running.forEach(function (o) { o.stop(); } );
    }
    return {
        'verify' : function (programs) {
            var f = function () {
                verify(foreground_done, programs);
            };
            setTimeout(f, 50);
        }
    };
}


function lines(a) {
    return a.join('\n') + '\n';
}

function times(count, f) {
    var a = [count];
    for (var i = 0; i < count; i++) a[i] = f(i);
    return lines(a);
}

function chain() {
    var args = Array.prototype.slice.apply(arguments);
    return args.reduceRight(function(a, b) { return b.bind(null, a); });
}

describe('brokered examples', function() {
    this.slow(500);

    it('helloworld', function(done) {
        verify(done, [example('helloworld.js').produces('Hello World!\n')]);
    });
    it('send and receive', function(done) {
        verify(done, [example('simple_recv.js').produces(times(100, function(i) { return '{"sequence":' + (i+1) + '}'})),
                      example('simple_send.js').produces(times(100, function(i) { return 'sent ' + (i+1)}) + 'all messages confirmed\n')]);
    });
    it('client/server', function(done) {
        var requests = ["Twas brillig, and the slithy toves",
                        "Did gire and gymble in the wabe.",
                        "All mimsy were the borogroves,",
                        "And the mome raths outgrabe."];
        var client_output = lines(requests.map(function (r) { return r + ' => ' + r.toUpperCase(); }));
        var server_output = lines(requests.map(function (r) { return 'Received: ' + r; }));
        while_running(done, [example('server.js').produces(server_output)]).verify([example('client.js').produces(client_output)]);
    });
    it('selector', function(done) {
        var red = lines(['panda', 'squirrel']);
        var blue = lines(['whale']);
        var green = lines(['grasshopper']);
        var send_output = lines(['sent red-panda',
                                 'sent green-grasshopper',
                                 'sent red-squirrel',
                                 'sent blue-whale']);
        verify(done, [example('selector/recv.js', ['-m', '2']).produces(red),
                      example('selector/recv.js', ['-m', '1', '-s', "colour = 'blue'"]).produces(blue),
                      example('selector/recv.js', ['-m', '1', '-s', "colour = 'green'"]).produces(green),
                      example('selector/send.js').produces(send_output)]);
    });
    it('rpc', function(done) {
        var client_output = lines(['fib(5) => 5',
                                   'fib(10) => 55',
                                   'Put item in remote map',
                                   'Retrieved bar from remote map']);
        while_running(done, [example('rpc/server.js')]).verify([example('rpc/client.js').produces(client_output)]);
    });

    it('pub-sub', function(done) {
        var messages = ['one', 'two', 'three', 'close'];
        var pub_output = lines(messages.map(function (m) { return 'sent ' + m; }));
        var sub_output = lines(messages.slice(0,3));
        verify(done, [example('durable_subscription/subscriber.js', ['-t', 'topic://PRICE.STOCK.NYSE.RHT']).produces(sub_output),
                      example('durable_subscription/publisher.js', messages).produces(pub_output)]);
    });

    it('queue browser', function(done) {
        this.slow(1000);
        var red = lines(['panda', 'squirrel']);
        var blue = lines(['whale']);
        var green = lines(['grasshopper']);

        var recv_output = lines(['"panda"',
                                 '"grasshopper"',
                                 '"squirrel"',
                                 '"whale"']);
        var send_output = lines(['sent red-panda',
                                 'sent green-grasshopper',
                                 'sent red-squirrel',
                                 'sent blue-whale']);
        function browse(f) {
            verify(f, [example('queue_browser.js', ['-m', '4']).produces(recv_output)]);
        }
        function consume(f) {
            verify(f, [example('simple_recv.js', ['-m', '4']).produces(recv_output)]);
        }
        function send(f) {
            verify(f, [example('selector/send.js').produces(send_output)]);
        }
        chain(send, browse, browse, consume, done)();
    });
});

describe('direct examples', function() {
    this.slow(500);

    it('helloworld', function(done) {
        verify(done, [example('direct_helloworld.js').produces('Hello World!\n')]);
    });
    it('send and receive', function(done) {
        verify(done, [example('direct_recv.js').produces(times(100, function(i) { return '{ sequence: ' + (i+1) + ' }'})),
                      example('simple_send.js', ['-p', '8888']).produces(times(100, function(i) { return 'sent ' + (i+1)}) + 'all messages confirmed\n')]);
    });
    it('tls connection', function(done) {
        while_running(done, [example('tls/tls_server.js', ['-p', '8888']).produces('Connected: TestClient\n')]).verify([example('tls/tls_client.js', ['-p', '8888']).produces('Connected!\n')]);
    });
    it('sasl anonymous', function(done) {
        while_running(done, [example('sasl/sasl_anonymous_server.js', ['-p', '8888']).produces('Connected!\n')]
                     ).verify([example('sasl/simple_sasl_client.js', ['-p', '8888', '--username', 'anonymous']).produces('Connected!\n')]);
    });
    it('sasl plain', function(done) {
        while_running(done, [example('sasl/sasl_plain_server.js', ['-p', '8888']).produces(lines(['Authenticating as bob', 'Connected!']))]
                     ).verify([example('sasl/simple_sasl_client.js', ['-p', '8888', '--username', 'bob', '--password', 'bob']).produces('Connected!\n')]);
    });
    it('websockets', function(done) {
        this.slow(1000);
        var output = times(100, function(i) { return 'sent request-' + (i+1) + '\nreceived request-' + (i+1)});
        while_running(done, [example('websockets/echo.js')]).verify([example('websockets/client.js', ['-u', 'ws:localhost:8888']).produces(output)]);
    });
    it('reconnect', function(done) {
        this.slow(1500);
        var server = example('reconnect/echo.js');
        server.restart = true;
        var client = example('reconnect/client.js', ['--request_interval', '5', '-m', '10']);
        client.verifier = function (output) {
            for (var i = 0; i < 10; i++) {
                var req = 'request-' + (i+1);
                assert.notEqual(output.indexOf('sent ' + req), -1);
                assert.notEqual(output.indexOf('received ' + req), -1);
            }
            assert.notEqual(output.indexOf('disconnected'), -1);
        };
        setTimeout(server.kill.bind(server), 400);
        while_running(done, [server]).verify([client]);
    });
});
