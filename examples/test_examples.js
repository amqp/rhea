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
};

Program.prototype.produces = function(text) {
    this.expected_output = text;
    return this;
};

Program.prototype.run = function(done) {
    var name = this.name;
    var p = child_process.fork(path.resolve(__dirname, this.name), this.args, {silent:true});
    p.stdout.on('data', function (data) {
        this.actual_output += data;
    });
    p.stderr.on('data', function (data) {
            console.log('stderr: ' + data);
    });
    p.on('close', function (code, signal) {
        if (this.expected_output) {
            assert.equal(this.actual_output, this.expected_output);
        }
    });
    p.on('exit', function (code, signal) {
        if (signal === null) assert.equal(code, 0);
        done();
    });
    return p;
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
                this.process = p.run(fn);
            },
            stop: function () {
                this.process.kill('SIGTERM');
            }
        }
    } );
    running.forEach(function (o) { o.start(); } );
    var foreground_done = function () {
        running.forEach(function (o) { o.stop(); } );
    }
    return {
        'verify' : function (programs) {
            verify(foreground_done, programs);
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

describe('brokered examples', function() {
    this.slow(500);
    /**
    beforeEach(function(done) {
        done();
    });

    afterEach(function() {
    });
    **/

    it('helloworld', function(done) {
        verify(done, [example('helloworld.js').produces('Hello World!\n')]);
    });
    it('simple send and receive', function(done) {
        verify(done, [example('simple_recv.js').produces(times(100, function(i) { return '{sequence:' + (i+1) + '}'})),
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
});

describe('direct examples', function() {
    this.slow(500);
    /**
    beforeEach(function(done) {
        done();
    });

    afterEach(function() {
    });
    **/

    it('helloworld', function(done) {
        verify(done, [example('direct_helloworld.js').produces('Hello World!\n')]);
    });
    it('direct send and receive', function(done) {
        verify(done, [example('direct_recv.js').produces(times(100, function(i) { return '{sequence:' + (i+1) + '}'})),
                      example('simple_send.js', ['-p', '8888']).produces(times(100, function(i) { return 'sent ' + (i+1)}) + 'all messages confirmed\n')]);
    });
});
