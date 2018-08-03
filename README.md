[![Build Status](https://travis-ci.org/amqp/rhea.svg?branch=master)](https://travis-ci.org/amqp/rhea)

# rhea

A reactive library for the [AMQP](http://amqp.org/) protocol, for easy
development of both clients and servers.

* [Hello World!](#hello-world)
* [API](#api)

## Hello World!

Brief example of sending and receiving a message through a
broker/server listening on port 5672:

```js
var container = require('rhea');
container.on('connection_open', function (context) {
    context.connection.open_receiver('examples');
    context.connection.open_sender('examples');
});
container.on('message', function (context) {
    console.log(context.message.body);
    context.connection.close();
});
container.once('sendable', function (context) {
    context.sender.send({body:'Hello World!'});
});
container.connect({'port':5672});
```

output:
```
Hello World!
```
## Dependencies

* debug (For simple debug logging - may be replaced in the near
  term. To enable set e.g. DEBUG=rhea* or DEBUG=rhea:events for more
  qualified debugging)

## Examples

There are some examples of using the library under the examples
folder. These include:

* [helloworld.js](examples/helloworld.js) - essentially the code above, which sends and receives
  a single message through a broker

* [direct_helloworld.js](examples/direct_helloworld.js) - an example
  showing the sending of a single message without the use of a broker,
  by listening on a port and then openning a connection to itself over
  which the message is transfered.

* [simple_send.js](examples/simple_send.js) - connects to a specified
  port then sends a number of messages to a given address

* [simple_recv.js](examples/simple_recv.js) - connects to a specified
  port then subscribes to receive a number of messages from a given
  address

These last two can be used together to demsontrate sending messages
from one process to another, using a broker or similar intermediary to
which they both connect.

* [direct_recv.js](examples/direct_recv.js) - listens on a given port
  for incoming connections over which it will then receive a number of
  messages

The direct_recv.js example can be used in conjunction with the
simple_send.js example to demonstrate sending messages between
processes without the use of any intermediary. Note however the the
default port of one or ther other will need to be changed through the
-p command line option.

* [client.js](examples/client.js) and [server.js](examples/server.js)
  - A request-response example where the 'client' sends messages to a
  'server' (or service) which converts them to upper case and sends
  them back. This demonstrates the use of temporary addresses among
  other things. Using these two together requires a broker or similar
  intermediary.

* In durable_subscription, a
  [subscriber](examples/durable_subscription/subscriber.js) and a
  [publisher]( examples/durable_subscription/publisher.js)which
  demonstrate the notion of a durable subscription when used in
  conjunction with a broker such as ActiveMQ

* In selector a [receiver](examples/selector/recv.js) that uses a
  selector - a SQL like query string that restricts the set of
  messages delivered - and an accompanying
  [sender](examples/selector/send.js)

* In sasl a [sasl client](examples/sasl/simple_sasl_client.js) showing
  how to authenticate to the service you connect to. This can be used
  against any broker as well as either of two example servers showing
  [anonymous](examples/sasl/sasl_anonymous_server.js) and
  [plain](examples/sasl/sasl_plain_server.js) mechanisms.

* A tls [client](examples/tls/tls_client.js) and
  [server](examples/tls/tls_server.js) demonstrating connecting (and
  possibly authenticating) over a tls secured socket.

* A [client](examples/reconnect/client.js) to demonstrate the built in
  automatic reconnection functionality along with a simple [echo
  server](examples/reconnect/echo.js) against which it can be run. It
  can of course also be run against a broker instead (or as well!).

* Both [node based](examples/websockets/client.js) and [web
  based](examples/websockets/client.html) websocket clients along with
  a [server](examples/websockets/echo.js) which will echo back any
  requests received. The clients can also be used against a websocket
  enabled AMQP broker with a queue or topic called 'examples'. The
  node based scritps require the 'ws' node module to be installed. The
  browser based example requires a browserified version of the rhea
  library (this can be created e.g. by calling npm run-script
  browserify or make browserify). The browserified and minimized javascript
  library is stored under the dist/ directory.

To run the examples you will need the dependencies installed: the
library itself depends on the 'debug' module, and some of the examples
depend on the 'yargs' module for command line option parsing.

The 'rhea' module itself must also be findable by node. You can do
this either by checking out the code from git and setting NODE_PATH to
include the directory to which you do so (i.e. the directory in which
'a directory named 'rhea' can be found, or you can install the module
using npm.

Some of the examples assume an AMQP compatible broker, such as those
offered by the ActiveMQ or Qpid Apache projects, is running.

## API

There are four core types of object in the API:

  * <a href="#container">Containers</a>,
  * <a href="#connection">Connections</a>,
  * <a href="#receiver">Receivers</a>,
  * and <a href="#sender">Senders</a>

Each of these inherits all the methods of EventEmitter, allowing
handlers for particular events to be attached. Events that are not
handled at sender or receiver scope are then propagated up to possibly
be handled at connection scope. Events that are not handled at
connection scope are then propagated up to possibly be handled at
container scope.

---------------------------------------------------------------------
### Container

An AMQP container from which outgoing connections can be made and/or
to which incoming connections can be accepted. The module exports a
default instance of a Container which can be used directly. Other
instances can be created from that if needed using the
create_container method. A container is identified by the
id property. By default a uuid is used, but the property
can be set to something more specific if desired before making or
accepting any connections.

#### methods:

##### connect(options)

Connects to the server specified by the host and port supplied in the
options and returns a <a href="#connection">Connection</a>.

The options argument is an object that may contain any of the
following fields:

  * host
  * port
  * username
  * password
  * container_id (overrides the container identifier)
  * hostname
  * servername
  * transport
  * sasl_init_hostname
  * idle_time_out
  * channel_max
  * max_frame_size
  * outgoing_locales
  * incoming_locales
  * sender_options
  * receiver_options
  * reconnect
    * if true (the default), the library will automatically attempt to
      reconnect if disconnected
    * if false, automatic reconnect will be disabled
    * if it is a numeric value, it is interpreted as the delay between
      reconnect attempts (in milliseconds)
    When enabled, reconnect can be further controlled via the
    following options:
    * initial_reconnect_delay (in milliseconds)
    * max_reconnect_delay (in milliseconds)
    * reconnect_limit (maximum number of reconnect attempts)
  * connection_details - a function which if specified will be invoked
    to get the options to use (e.g. this can be used to alternate
    between a set of different host/port combinations)
  * non_fatal_errors - an array of error conditions which if received
    on connection close from peer should not prevent reconnect (by
    default this only includes amqp:connection:forced)

If the transport is TLS, the options may additionally specify a
'servername' property. This allows the SNI to be controlled separately
from the host option. If servername is not specified, the SNI will
default to the host.

##### listen(options)

Starts a server socket listening for incoming connections on the port
(and optionally interface) specified in the options.

The options argument is an object that may contain any of the
following fields:

  * host
  * port

##### create_container()

Returns a new container instance. The method takes an options object
which can contain the following field:

  * id

If no id is specified a new uuid will be generated.

##### generate_uuid()

Simple utility for generating a stringified uuid, useful if you wish
to specify distinct container ids for different connections.

##### websocket_connect()

Returns a function that can be used to create another function
suitable for use as the value of 'connection_details' in a connect
call in order to connect over websockets. The function returned here
takes a websocket url and optional arguments. The websocket_connect
method itself take the constructor of the WebSocket implementation to
use. It has been tested with the implementation in firefox and also
that in the node module 'ws'.

##### websocket_accept()

Used to start handling an incoming websocket connection as an AMQP
connection. See the [websocket echo server
example](example/websocket/echo.js) for how to use it.

---------------------------------------------------------------------
### Connection

#### methods:

##### open_receiver(address|options)

Establishes a link over which messages can be received and returns a
<a href="#receiver">Receiver</a> representing that link. A receiving
link is a subscription, i.e. it expresses a desire to receive
messages.

The argument to this method can either be a simple string indicating
the source of messages of interest (e.g. a queue name), or an options
object that may contain any of the following fields:

  * source - The source from which messages are received. This can be
    a simple string address/name or a nested object itself containing
    the fields:
    * address
    * dynamic
    * expiry_policy
    * durable
  * target - The target of a receiving link is the local
    identifier. It is often not needed, but can be set if it is,
  * name - The name of the link. This should be unique for the
    container. If not specified a unqiue name is generated.
  * credit_window - A 'prefetch' window controlling the flow of
    messages over this receiver. Defaults to 500 if not specified. A
    value of 0 can be used to turn of automatic flow control and
    manage it directly.
  * autoaccept - Whether received messages should be automatically
    accepted. Defaults to true.

Note: If the link doesn't specify a value for the credit_window and
autoaccept options, the connection options are consulted followed by
the container options. The default is used only if an option is not
specified at any level.

##### open_sender(address|options)

Establishes a link over which messages can be sent and returns a <a
href="#sender">Sender</a> representing that link. A sending link is an
analogous concept to a subscription for outgoing rather than incoming
messages. I.e. it expresses a desire to send messages.

The argument to this method can either be a simple string indicating
the target for messages of interest (e.g. a queue name), or an options
object that may contain any of the following fields:

  * target - The target to which messages are sent. This can be a
    simple string address/name or a nested object itself containing
    the fields:
    * address
    * dynamic
    * expiry_policy
    * durable
  * source - The source of a sending link is the local identifier. It
    is usually not needed, but can be set if it is,
  * name - The name of the link. This should be unique for the
    container. If not specified a unqiue name is generated.
  * autosettle - Whether sent messages should be automatically
    settled once the peer settles them. Defaults to true.

Note: If the link doesn't specify a value for the autosettle option,
the connection options are consulted followed by the container
options. The default is used only if an option is not specified at any
level.

##### send(message)

Sends the specified message over the default sender, which is a
sending link whose target address is null. The use of this method
depends on the peer supporting so-called 'anonymous relay' semantics,
which most AMQP 1.0 brokers do. The message should have the 'to' field
set to the intended destination.

##### close()

Closes a connection (may take an error object which is an object
that consists of condition and description fields).

##### is_open()/is_closed()

Provide information about the connection status. If it's opened or closed.

#### events:

##### connection_open

Raised when the remote peer indicates the connection is open.

##### connection_close

Raised when the remote peer indicates the connection is closed.

##### connection_error

Raised when the remote peer indicates the connection is closed and
specifies an error. A `connection_close` event will always follow this
event, so it only needs to be implemented if there are specific actions
to be taken on a close with an error as opposed to a close. The error
is available as a property on the event context.

If neither the connection_error or the connection_close is handled by
the application, an error event will be raised. This can be handled on
the connection or the container. If this is also unhandled, the
application process will exit.

##### disconnected

Raised when the underlying tcp connection is lost. The context has a
`reconnecting` property which is true if the library is attempting to
automatically reconnect and false if it has reached the reconnect
limit. If reconnect has not been enabled or if the connection is a tcp
server, then the `reconnecting` property is undefined. The context may
also have an `error` property giving some information about the reason
for the disconnect. If the disconnect event is not handled, a warning
will be logged to the console.

---------------------------------------------------------------------
### Receiver

#### methods:

##### close()

Closes a receiving link (i.e. cancels the subscription). (May take an error object which is an object
that consists of condition and description fields).

##### detach()

Detaches a link without closing it. For durable subscriptions this
means the subscription is inactive, but not cancelled.

##### add_credit(n)

By default, receivers have a prefetch window that is moved
automatically by the library. However if desired the application can
set the prefecth to zero and manage credit itself. Each invocation of
add_credit() method issues credit for a further 'n' messages to be
sent by the peer over this receiving link. [Note: flow()is an alias
for add_credit()]

##### credit()

Returns the amount of outstanding credit that has been issued.

#### events:

##### message

Raised when a message is received.

##### receiver_open

Raised when the remote peer indicates the link is open (i.e. attached
in AMQP parlance).

##### receiver_close

Raised when the remote peer indicates the link is closed.

---------------------------------------------------------------------
### Sender

#### methods:

##### send(msg)

Sends a message. A message is an object that may contain the following fields:

  * durable
  * first_acquirer
  * priority
  * ttl
  * delivery_count
  * reply_to
  * to
  * subject
  * content_type
  * content_encoding
  * group_id
  * message_id
  * correlation_id
  * application_properties, an object/map which can take arbitrary, application defined named values
  * body, which can be either a string, an object or a buffer

##### close()

Closes a sending link (may take an error object which is an object
that consists of condition and description fields).

##### detach()

Detaches a link without closing it.

##### sendable()

Returns true if the sender has available credits for sending a message. Otherwise it returns false.

#### events:

##### sendable

Raised when the sender has sufficient credit to be able to transmit
messages to its peer.

##### accepted

Raised when a sent message is accepted by the peer.

##### released

Raised when a sent message is released by the peer.

##### rejected

Raised when a sent message is rejected by the peer.

##### sender_open

Raised when the remote peer indicates the link is open (i.e. attached
in AMQP parlance).

##### sender_close

Raised when the remote peer indicates the link is closed.

---------------------------------------------------------------------
**Note: For detailed options and types, please refer to the type definitions
in the [typings](./typings) directory**.

