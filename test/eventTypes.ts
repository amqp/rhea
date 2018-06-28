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

import * as assert from "assert";
import * as rhea from "../";

describe('event types', function() {
    it('for ReceiverEvents are well defined', function(done){
        assert.equal(rhea.ReceiverEvents.message, "message");
        assert.equal(rhea.ReceiverEvents.receiverClose, "receiver_close");
        assert.equal(rhea.ReceiverEvents.receiverDrained, "receiver_drained");
        assert.equal(rhea.ReceiverEvents.receiverFlow, "receiver_flow");
        assert.equal(rhea.ReceiverEvents.receiverError, "receiver_error");
        assert.equal(rhea.ReceiverEvents.receiverOpen, "receiver_open");
        assert.equal(rhea.ReceiverEvents.settled, "settled");
        done();
    });
    it('for SenderEvents are well defined', function(done){
        assert.equal(rhea.SenderEvents.accepted, "accepted");
        assert.equal(rhea.SenderEvents.rejected, "rejected");
        assert.equal(rhea.SenderEvents.released, "released");
        assert.equal(rhea.SenderEvents.modified, "modified");
        assert.equal(rhea.SenderEvents.senderDraining, "sender_draining");
        assert.equal(rhea.SenderEvents.senderFlow, "sender_flow");
        assert.equal(rhea.SenderEvents.sendable, "sendable");
        assert.equal(rhea.SenderEvents.senderClose, "sender_close");
        assert.equal(rhea.SenderEvents.senderError, "sender_error");
        assert.equal(rhea.SenderEvents.senderOpen, "sender_open");
        assert.equal(rhea.SenderEvents.sendable, "sendable");
        assert.equal(rhea.SenderEvents.settled, "settled");
        done();
    });
    it('for SessionEvents are well defined', function(done){
        assert.equal(rhea.SessionEvents.sessionClose, "session_close");
        assert.equal(rhea.SessionEvents.sessionError, "session_error");
        assert.equal(rhea.SessionEvents.sessionOpen, "session_open");
        assert.equal(rhea.SessionEvents.settled, "settled");
        done();
    });
    it('for ConnectionEvents are well defined', function(done){
        assert.equal(rhea.ConnectionEvents.connectionClose, "connection_close");
        assert.equal(rhea.ConnectionEvents.connectionError, "connection_error");
        assert.equal(rhea.ConnectionEvents.connectionOpen, "connection_open");
        assert.equal(rhea.ConnectionEvents.protocolError, "protocol_error");
        assert.equal(rhea.ConnectionEvents.error, "error");
        assert.equal(rhea.ConnectionEvents.disconnected, "disconnected");
        assert.equal(rhea.ConnectionEvents.settled, "settled");
        done();
    });
});