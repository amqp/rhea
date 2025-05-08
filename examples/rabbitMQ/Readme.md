# Getting Started with AMQP 1.0 and RabbitMQ

This guide will help you set up and use AMQP 1.0 with RabbitMQ, using the included Node.js scripts for queue management, message sending, and receiving.

## Prerequisites

- RabbitMQ server (4.0+)
- Node.js (12.0+)
- Administrator privileges (for RabbitMQ plugin management)

## Installation

1. **Install RabbitMQ** (if not already installed):

   ```bash
   # Fedora
   sudo dnf install rabbitmq-server

   # Debian/Ubuntu
   sudo apt-get install rabbitmq-server

   # MacOS
   brew install rabbitmq
   ```

2. **Enable the AMQP 1.0 plugin (only for version < 4.0 and 3.8+)**:

   ```bash
   sudo rabbitmq-plugins enable rabbitmq_amqp1_0
   sudo systemctl restart rabbitmq-server
   ```

3. **Install Node.js dependencies**:

- remember to run npm install from the root

4. **Clone or download the example scripts** to your working directory.

## Overview of Components

This package includes several components that work together:

1. **`options.js`** - A utility module for command-line argument parsing
2. **`rabbitmq_queue_setup.js`** - Queue management script
3. **`rabbitmq_sender.js`** - AMQP 1.0 message sender
4. **`rabbitmq_receiver.js`** - AMQP 1.0 message receiver
5. **`run_rabbitmq_demo.sh`** - Demo script to showcase all components working together

## Quick Start

For a quick demonstration of all components working together:

```bash
chmod +x run_rabbitmq_demo.sh
./run_rabbitmq_demo.sh
```

This script will:

1. Check if RabbitMQ is running
2. Verify the AMQP 1.0 plugin is enabled
3. Create a test queue
4. Start a message receiver in the background
5. Send 5 test messages
6. Show the receiver's output
7. Optionally clean up the test queue

## Working with Queues

The `rabbitmq_queue_setup.js` script provides functionality to create, delete, and manage RabbitMQ queues through the RabbitMQ Management API.

### Creating a Queue

```bash
node rabbitmq_queue_setup.js --queue=my_queue --durable=true
```

### Deleting a Queue

```bash
node rabbitmq_queue_setup.js --queue=my_queue --delete
```

### Purging a Queue

```bash
node rabbitmq_queue_setup.js --queue=my_queue --purge
```

### Binding a Queue to an Exchange

```bash
node rabbitmq_queue_setup.js --queue=my_queue --exchange=my_exchange --routing_key=my_key
```

### Queue Configuration Options

| Option          | Alias | Description                               | Default            |
| --------------- | ----- | ----------------------------------------- | ------------------ |
| `--queue`       | `-n`  | Name of the queue to create               | `test_queue`       |
| `--exchange`    | `-e`  | Name of the exchange to bind the queue to | -                  |
| `--routing_key` | `-r`  | Routing key for binding                   | Same as queue name |
| `--durable`     | `-d`  | Make the queue durable                    | `true`             |
| `--auto_delete` | `-a`  | Auto-delete the queue when not in use     | `false`            |
| `--delete`      | `-x`  | Delete the queue instead of creating it   | `false`            |
| `--purge`       | `-p`  | Purge all messages from the queue         | `false`            |
| `--username`    | `-u`  | Username for RabbitMQ Management API      | `guest`            |
| `--password`    | `-w`  | Password for RabbitMQ Management API      | `guest`            |
| `--host`        | `-h`  | Hostname of the RabbitMQ server           | `localhost`        |
| `--port`        | `-P`  | Port for RabbitMQ Management API          | `15672`            |

## Sending Messages

The `rabbitmq_sender.js` script uses the AMQP 1.0 protocol to send messages to RabbitMQ queues or exchanges.

### Basic Usage

```bash
node rabbitmq_sender.js --node=my_queue --count=10
```

### Sending to an Exchange with Routing Key

```bash
node rabbitmq_sender.js --node=my_exchange --address=my_routing_key --count=5
```

### Sender Configuration Options

| Option       | Alias | Description                                        | Default      |
| ------------ | ----- | -------------------------------------------------- | ------------ |
| `--node`     | `-n`  | Name of the queue or exchange to send messages to  | `test_queue` |
| `--address`  | `-a`  | Address to use (e.g., routing key for an exchange) | -            |
| `--count`    | `-c`  | Number of messages to send                         | `10`         |
| `--interval` | `-i`  | Interval between messages in milliseconds          | `1000`       |
| `--username` | `-u`  | Username for authentication                        | `guest`      |
| `--password` | `-p`  | Password for authentication                        | `guest`      |
| `--host`     | `-h`  | Hostname of the RabbitMQ server                    | `localhost`  |
| `--port`     | `-P`  | AMQP service port                                  | `5672`       |

## Receiving Messages

The `rabbitmq_receiver.js` script uses the AMQP 1.0 protocol to receive messages from RabbitMQ queues.

### Basic Usage

```bash
node rabbitmq_receiver.js --node=my_queue
```

### Receiving a Limited Number of Messages

```bash
node rabbitmq_receiver.js --node=my_queue --count=5
```

### Receiver Configuration Options

| Option       | Alias | Description                                   | Default      |
| ------------ | ----- | --------------------------------------------- | ------------ |
| `--node`     | `-n`  | Name of the queue to receive messages from    | `test_queue` |
| `--count`    | `-c`  | Number of messages to receive (0 = unlimited) | `0`          |
| `--username` | `-u`  | Username for authentication                   | `guest`      |
| `--password` | `-p`  | Password for authentication                   | `guest`      |
| `--host`     | `-h`  | Hostname of the RabbitMQ server               | `localhost`  |
| `--port`     | `-P`  | AMQP service port                             | `5672`       |
| `--auto_ack` | `-a`  | Automatic message acknowledgment              | `true`       |
| `--prefetch` | `-f`  | Credit window size (prefetch count)           | `10`         |

## Advanced Usage

### Custom Message Properties

The sender script allows you to customize message properties. You can modify the `send_message` function in `rabbitmq_sender.js` to include additional properties:

```javascript
sender.send({
  message_id: message_id,
  user_id: args.username,
  creation_time: new Date(),
  subject: args.address || args.node,
  content_type: "application/json",
  application_properties: {
    source: "rhea-rabbitmq-sender",
    message_type: "test",
    routing_key: args.address,
    // Add your custom properties here
    priority: 1,
    correlation_id: "request-123",
    custom_property: "custom-value",
  },
  body: message_body,
});
```

### Handling Message Acknowledgments

By default, the receiver automatically acknowledges messages. To handle acknowledgments manually:

```bash
node rabbitmq_receiver.js --auto_ack=false
```

This allows you to acknowledge messages after processing:

```javascript
container.on("message", function (context) {
  // Process the message
  console.log("Processing message:", context.message.body);

  // Custom acknowledgment logic
  if (processSuccessful) {
    context.delivery.accept();
  } else {
    context.delivery.reject();
  }
});
```

### Using Exchanges with AMQP 1.0

To send messages to an exchange:

1. Create an exchange in RabbitMQ (using the Management UI or command line)
2. Bind a queue to this exchange with a routing key
3. Send messages to the exchange with the appropriate routing key:

```bash
node rabbitmq_sender.js --node=my_exchange --address=my_routing_key
```

## Troubleshooting

### Common Issues

1. **Connection Refused**

   - Ensure RabbitMQ is running: `sudo systemctl status rabbitmq-server`
   - Check if the AMQP port is open: `telnet localhost 5672`

2. **Authentication Failed**

   - Verify username and password: `rabbitmqctl list_users`
   - Set correct credentials: `--username=user --password=pass`

3. **AMQP 1.0 Protocol Error**

   - Verify the plugin is enabled: `rabbitmq-plugins list -e | grep amqp1_0`
   - Restart RabbitMQ after enabling the plugin: `sudo systemctl restart rabbitmq-server`

4. **Queue Not Found**
   - Verify the queue exists: `rabbitmqctl list_queues`
   - Create the queue first using `rabbitmq_queue_setup.js`

### Logging and Debugging

For more detailed logging, you can modify the scripts to include debugging information:

```javascript
// Enable rhea debug logging
container.on("connection_open", function (context) {
  console.log("Connection details:", context.connection.options);
});

container.on("error", function (context) {
  console.error("Error details:", context.error);
});
```

## Extending the Scripts

The included scripts provide a foundation that you can extend for your specific use cases:

1. **Add Message Filtering** - Modify the receiver to filter messages based on properties
2. **Implement Request-Reply Pattern** - Add correlation IDs and reply-to addresses
3. **Message Transformation** - Transform messages before sending or after receiving
4. **Error Handling** - Add robust error handling and retry logic
5. **Monitoring** - Add metrics collection for monitoring message flow

## Resources

- [RabbitMQ AMQP 1.0 Plugin Documentation](https://www.rabbitmq.com/plugins.html#rabbitmq_amqp1_0)
- [AMQP 1.0 Specification](http://docs.oasis-open.org/amqp/core/v1.0/os/amqp-core-overview-v1.0-os.html)
- [Rhea AMQP Client Library](https://github.com/amqp/rhea)
- [RabbitMQ Management HTTP API](https://rawcdn.githack.com/rabbitmq/rabbitmq-server/v4.0.0/deps/rabbitmq_management/priv/www/api/index.html)

## Conclusion

This guide covers the basics of working with AMQP 1.0 and RabbitMQ using the included Node.js scripts. You can use these examples as a starting point for building more complex messaging applications.

For production use, consider adding features such as:

- SSL/TLS security
- Connection pooling
- Robust error handling and retries
- Monitoring and alerting
- Message persistence guarantees
