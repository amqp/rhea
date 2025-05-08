/*
 * AMQP 1.0 sender example for RabbitMQ
 */
var container = require('rhea');

var args = require('./options.js')
    .options({
        n: {
            alias: 'node',
            default: 'test_queue',
            describe: 'name of the queue or exchange to send messages to',
        },
        a: {
            alias: 'address',
            default: '',
            describe: 'address to use (e.g. routing key for an exchange)',
        },
        c: {
            alias: 'count',
            default: 10,
            describe: 'number of messages to send',
        },
        i: {
            alias: 'interval',
            default: 1000,
            describe: 'interval between messages in milliseconds',
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
    })
    .help('help').argv;

// Configure connection options
var connection_options = {
    port: args.port,
    host: args.host,
    username: args.username,
    password: args.password,
    reconnect: true,
    container_id: 'rhea-rabbitmq-sender',
};

console.log('Connecting to RabbitMQ at %s:%s...', args.host, args.port);
var connection = container.connect(connection_options);

var sent = 0;
var confirmed = 0;
var total = args.count;
var sender;

// When the connection is established
container.on('connection_open', function (context) {
    console.log('Connected to RabbitMQ');

    // Create a sender for the specified address
    var target = {};
    if (args.address) {
    // If sending to an exchange, set the address and use 'address' as routing key
        target = {
            address: args.node,
            capabilities: ['topic'],
        };
        sender = context.connection.open_sender({
            target: target,
            properties: {
                'routing-key': args.address,
                subject: args.address,
            },
        });
    } else {
    // For direct access to the queue
        target = {
            address: args.node,
        };
        sender = context.connection.open_sender({
            target: target,
        });
    }

    console.log(
        'Created sender to %s (address: %s)',
        args.node,
        args.address || args.node
    );
});

// When the sender link is opened
container.on('sender_open', function (context) {
    console.log('Sender link established');

    // Set a timer to send messages periodically
    var message_interval = setInterval(function () {
        if (sent < total) {
            if (context.sender.sendable()) {
                send_message(context.sender);
            }
        } else {
            clearInterval(message_interval);
            // Wait for pending confirmations
            if (confirmed >= total) {
                context.sender.close();
                context.connection.close();
            }
        }
    }, args.interval);
});

// When we can send messages (credit available)
container.on('sendable', function (context) {
    if (sent < total) {
        send_message(context.sender);
    } else if (confirmed >= total) {
        context.sender.close();
        context.connection.close();
    }
});

// When the message is confirmed by RabbitMQ
container.on('accepted', function (context) {
    confirmed++;
    console.log(
        'Message %d confirmed, total confirmed: %d',
        context.delivery.id,
        confirmed
    );

    if (confirmed >= total && sent >= total) {
        context.sender.close();
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
    } else {
        console.log('Exiting');
        process.exit(0);
    }
});

// Function to send a message
function send_message(sender) {
    sent++;
    var message_id = sent;
    var message_body = {
        sequence: message_id,
        text: 'Message ' + message_id,
        timestamp: new Date().toISOString(),
    };

    console.log('Sending message %d: %j', message_id, message_body);

    // Send the message with properties
    sender.send({
        message_id: message_id,
        user_id: args.username,
        creation_time: new Date(),
        subject: args.address || args.node,
        content_type: 'application/json',
        application_properties: {
            source: 'rhea-rabbitmq-sender',
            message_type: 'test',
            routing_key: args.address,
        },
        body: message_body,
    });
}
