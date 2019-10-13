import * as rhea from "../";
import {Server} from "net";
import * as assert from "assert";
import {Readable} from "stream";
import {Message} from "../";

describe('stream', function () {
    var server: rhea.Container,
        client: rhea.Container,
        listener: Server;

    beforeEach(function (done: Function) {
        server = rhea.create_container();
        client = rhea.create_container();
        listener = server.listen({port: 0});
        listener.on('listening', function () {
            done();
        });
    });

    afterEach(function () {
        listener.close();
    });

    it('open sender stream', function (done: Function) {
        let receiveCounter = 0;
        let sendCounter = 0;
        let pauseCounter = 0;
        server.on('message', function (context) {
            if (receiveCounter < 1000) {
                assert.equal(context.message.body, 'mississippi_' + (++receiveCounter));
            } else {
                assert.equal(context.message.body, 'enough_mississippi');
                senderStream.link.connection.close();
            }
        });
        client.once('sendable', function () {
            do {
                readable.push({body: 'mississippi_' + ++sendCounter});
            } while (sendCounter < 1000);
            readable.push({body: 'enough_mississippi'});
        });
        client.on('connection_close', function () {
            assert.equal(pauseCounter, 200);
            done();
        });
        const senderStream = client.connect(listener.address()).open_sender_stream({highWaterMark: 5});
        const readable = new Readable({highWaterMark: 1000, objectMode: true, read() {}})
            .on('pause', () => pauseCounter++);
        readable.pipe(senderStream);
    });

    it('open receiver stream', function (done: Function) {
        let receiveCounter = 0;
        let sendCounter = 0;
        client.on('message', function(context) {
            assert.equal(context.message.body, 'settle-me');
        });
        client.on('connection_close', function () {
            done();
        });
        let receiverStream = client.connect(listener.address()).attach_receiver_stream({credit_window: 5})
            .on('data', function (context: {message: Message}) {
                if (receiveCounter < 1000) {
                    assert.equal(context.message.body, 'mississippi_' + (++receiveCounter));
                } else {
                    assert.equal(context.message.body, 'enough_mississippi');
                    receiverStream.link.connection.close();
                }
            });
        server.once('sendable', function (context) {
            receiverStream.link.on('receiver_open', function () {
                do {
                    context.sender.send({body: 'mississippi_' + ++sendCounter});
                } while (sendCounter < 1000);
                context.sender.send({body: 'enough_mississippi'});
            });
        });
    });
});
