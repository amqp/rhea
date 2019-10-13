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

var util = require('util');
var Readable = require('stream').Readable;
var Writable = require('stream').Writable;

var ReceiverStream = function (receiverLink) {
    var highWaterMark = receiverLink.get_option('credit_window', 1000);
    this.link = receiverLink;
    this.link.setMaxListeners(0);
    this.setMaxListeners(0);
    Readable.call(this, {objectMode: true, highWaterMark: highWaterMark});

    this.link.on('message', this._processMessage.bind(this));
};
util.inherits(ReceiverStream, Readable);
ReceiverStream.prototype._read = function (size) {
    if (this.link.credit <= 0) {
        this.link.add_credit(size);
    }
};
ReceiverStream.prototype._processMessage = function (content) {
    if (content && !this.push(content)) {
        return this.link.set_credit_window(0);
    }
};

var SenderStream = function (senderLink, options) {
    options = options || {};
    var highWaterMark = options.highWaterMark || 1000;
    this.link = senderLink;
    this.link.setMaxListeners(0);
    this.setMaxListeners(0);
    Writable.call(this, {objectMode: true, highWaterMark: highWaterMark});
};
util.inherits(SenderStream, Writable);
SenderStream.prototype._write = function (chunk, encoding, callback) {
    var delivery = this.link.send(chunk);
    var onSettled = function () {
        if (delivery.settled) {
            callback();
        } else {
            delivery.link.once('settled', onSettled);
        }
    };
    delivery.link.once('settled', onSettled);
};

module.exports = { 'ReceiverStream': ReceiverStream, 'SenderStream': SenderStream };
