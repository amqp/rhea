/*
 * AMQP 1.0 receiver example for RabbitMQ
 */

// var container = require('rhea');
var container = require('../../lib/container.js'); // local rhea version

var args = require('./options.js')
    .options({
        n: {
            alias: 'node',
            default: 'test_queue',
            describe: 'name of the queue to receive messages from',
        },
        c: {
            alias: 'count',
            default: 0,
            describe: 'number of messages to receive (0 = unlimited)',
        },
        u: {
            alias: 'username',
            default: 'guest',
            describe: 'username for authentication',
        },
        p: {
            alias: 'password',
            default: 'guest',
            describe: 'password for authentication',
        },
        h: {
            alias: 'host',
            default: 'localhost',
            describe: 'hostname of the RabbitMQ server',
        },
        P: { alias: 'port', default: 5672, describe: 'AMQP service port' },
        a: {
            alias: 'auto_ack',
            type: 'boolean',
            default: true,
            describe: 'automatic message acknowledgment',
        },
        f: {
            alias: 'prefetch',
            default: 10,
            describe: 'credit window size',
        },
    })
    .help('help').argv;

// Configure connection options
var connection_options = {
    port: args.port,
    host: args.host,
    username: args.username,
    password: args.password,
    reconnect: true,
    container_id: 'rhea-rabbitmq-receiver',
};

var received = 0;
var expected = args.count;

console.log('Connecting to RabbitMQ at %s:%s...', args.host, args.port);
container.connect(connection_options);

// When the connection is established
container.on('connection_open', function (context) {
    console.log('Connected to RabbitMQ');

    // Create a receiver from the specified queue
    var source = {
        address: args.node,
    };
    context.connection.open_receiver({
        source: source,
        credit_window: args.prefetch,
        autoaccept: args.auto_ack,
    });

    console.log('Created receiver from queue: %s', args.node);
});

// When the receiver link is opened
container.on('receiver_open', function () {
    console.log('Receiver link established');
    console.log('Waiting for messages...');
});

// When a message is received
container.on('message', function (context) {
    received++;

    // Extract message information
    var msg = context.message;
    var delivery = context.delivery;

    console.log('\n--- Message %d received ---', received);
    console.log('Message ID: %s', msg.message_id);
    console.log('User ID: %s', msg.user_id);
    console.log(
        'Created: %s',
        msg.creation_time ? new Date(msg.creation_time).toISOString() : 'N/A'
    );
    console.log('Subject: %s', msg.subject);
    console.log('Content type: %s', msg.content_type);

    // Display application properties if present
    if (msg.application_properties) {
        console.log('Application properties:');
        for (var key in msg.application_properties) {
            console.log('  %s: %s', key, msg.application_properties[key]);
        }
    }

    // Display message body
    console.log('Body: %j', msg.body);

    // Manual acknowledgment if auto-ack is disabled
    if (!args.auto_ack) {
        delivery.accept();
    }

    // Check if we have received all expected messages
    if (expected > 0 && received >= expected) {
        console.log('Received all expected messages (%d). Closing.', expected);
        context.receiver.close();
        context.connection.close();
    }
});

// When the connection is lost
container.on('disconnected', function (context) {
    if (context.error) {
        console.error('Disconnected due to error: %s', context.error);
    } else {
        console.log('Disconnected');
    }

    if (context.reconnecting) {
        console.log('Attempting to reconnect...');
    } else if (expected > 0 && received < expected) {
        console.log(
            'Exiting after receiving %d of %d messages',
            received,
            expected
        );
        throw new Error('Incomplete message reception');
    } else {
        console.log('Exiting');
    }
});
