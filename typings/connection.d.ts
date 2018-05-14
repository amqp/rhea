/// <reference types="node" />

import { EndpointState } from "./endpoint";
import { Session, Delivery } from "./session";
import { Transport } from "./transport";
import { Sender, Receiver, link } from "./link";
import { Socket } from "net";
import { frames } from "./frames";
import { EventEmitter } from "events";
import { Container } from "./container";

/**
 * Defines the common set of properties that are applicable for a connection, session and a link (sender, receiver).
 * @interface EntityOptions
 */
export interface EntityOptions {
  /**
   * @property {any} [desired_capabilities] Extension capabilities the sender can use if the receiver supports them.
   */
  desired_capabilities?: any;
  /**
   * @property {any} [offered_capabilities] Extension capabilities the sender supports.
   */
  offered_capabilities?: any;
  /**
   * @property {object} [properties] Properties of the entity (connection, session, link) contain a set of fields
   * intended to provide more information about the entity.
   */
  properties?: { [x: string]: any };
}

/**
 * Defines the options that can be provided while creating a connection.
 * @interface ConnectionOptions
 * @extends EntityOptions
 */
export interface ConnectionOptions extends EntityOptions {
  /**
   * @property {string} username - The username.
   */
  username: string;
  /**
   * @property {string} host - The host to connect to.
   */
  host: string;
  /**
   * @property {string} hostname - The hostname to connect to.
   */
  hostname: string;
  /**
   * @property {number} port - The port number (5671 or 5672) at which to connect to.
   */
  port: number;
  /**
   * @property {string} [transport] - The transport option.
   */
  transport?: "tls" | "ssl" | "tcp";
  connection_details: {
    host: "string",
    port: number;
    options: ConnectionOptions;
    connect: any;
  }
  /**
   * @property {string} [container_id] The id of the source container. If not provided then
   * this will a guid string.
   */
  container_id?: string;
  /**
   * @property {string} [id] A unqiue name for the connection. If not provided then this will be
   * a string in the following format: "connection-<counter>".
   */
  id?: string;
  /**
   * @property {boolean} [reconnect] if true (default), the library will automatically attempt to
   * reconnect if disconnected.
   * - if false, automatic reconnect will be disabled
   * - if it is a numeric value, it is interpreted as the delay between
   * reconnect attempts (in milliseconds)
   */
  reconnect?: boolean;
  /**
   * @property {number} [reconnect_limit] maximum number of reconnect attempts.
   * Applicable only when reconnect is true.
   */
  reconnect_limit?: number;
  /**
   * @property {number} [initial_reconnect_delay] - Time to wait in milliseconds before
   * attempting to reconnect. Applicable only when reconnect is true or a number is
   * provided for reconnect.
   */
  initial_reconnect_delay?: number;
  /**
   * @property {number} [max_reconnect_delay] - Maximum reconnect delay in milliseconds
   * before attempting to reconnect. Applicable only when reconnect is true.
   */
  max_reconnect_delay?: number;
  /**
   * @property {string} [password] - The secret key to be used while establishing the connection.
   */
  password?: string;
  /**
   * @property {number} [max_frame_size] The largest frame size that the sending peer
   * is able to accept on this connection. Default: 4294967295
   */
  max_frame_size?: number;
  /**
   * @property {number} [idle_time_out] The largest frame size that the sending
   * peer is able to accept on this connection.
   */
  idle_time_out?: number;
  /**
   * @property {number} [channel_max] The highest channel number that can be used on the connection.
   */
  channel_max?: number;
  /**
   * @property {string[]} [outgoing_locales] A list of the locales that the peer supports
   * for sending informational text.
   */
  outgoing_locales?: string[];
  /**
   * @property {string[]} [incoming_locales] A list of locales that the sending peer
   * permits for incoming informational text. This list is ordered in decreasing level of preference.
   */
  incoming_locales?: string[];
}

/**
 * Defines the common set of options that can be provided while creating a link (sender, receiver).
 * @interface LinkOptions
 * @extends EntityOptions
 */
export interface LinkOptions extends EntityOptions {
  /**
   * @property {string} [name] The name of the link.
   * This should be unique for the container.
   * If not specified a unqiue name is generated.
   */
  name?: string;
  /**
   * @property {number} [snd_settle_mode] it specifies the sender settle mode with following possibile values:
   * - 0 - "unsettled" - The sender will send all deliveries initially unsettled to the receiver.
   * - 1 - "settled" - The sender will send all deliveries settled to the receiver.
   * - 2 - "mixed" - (default) The sender MAY send a mixture of settled and unsettled deliveries to the receiver.
   */
  snd_settle_mode?: 0 | 1 | 2;
  /**
   * @property {number} [rcv_settle_mode] it specifies the receiver settle mode with following possibile values:
   * - 0 - "first" - The receiver will spontaneously settle all incoming transfers.
   * - 1 - "second" - The receiver will only settle after sending the disposition to the sender and receiving a
   * disposition indicating settlement of the delivery from the sender.
   */
  rcv_settle_mode?: 0 | 1;
  /**
   * @property {number} [max_message_size] The maximum message size supported by the link endpoint.
   */
  max_message_size?: number;
}

/**
 * Defines the options that can be provided while creating the source/target for a Sender or Receiver (link).
 * @interface TerminusOptions
 */
export interface TerminusOptions {
  /**
   * @property {string} [address] - The AMQP address as target for this terminus.
   */
  address: string;
  /**
   * @property {object} [filter] - The filters to be added for the terminus.
   */
  filter?: {
    [x: string]: any;
  };
  /**
   * @property {boolean} [durable] - It specifies a request for the receiving peer
   * to dynamically create a node at the target/source. Default: false.
   */
  dynamic?: boolean;
  /**
   * @property {string} [expiry_policy] - The expiry policy of the terminus. Default value "session-end".
   */
  expiry_policy?: string;
  /**
   * @property {number} [durable] It specifies what state of the terminus will be retained durably:
   *  - the state of durable messages (unsettled_state value),
   *  - only existence and configuration of the terminus (configuration value), or
   *  - no state at all (none value);
   */
  durable?: number;
}

/**
 * Defines the options that can be set while creating the Receiver (link).
 * @interface ReceiverOptions
 * @extends LinkOptions
 */
export interface ReceiverOptions extends LinkOptions {
  /**
   * @property {object} [credit_window]  A "prefetch" window controlling the flow of messages over
   * this receiver. Defaults to 1000 if not specified. A value of 0 can be used to
   * turn of automatic flow control and manage it directly.
   */
  credit_window?: number;
  /**
   * @property {boolean} [autoaccept] Whether received messages should be automatically accepted. Defaults to true.
   */
  autoaccept?: boolean;
  /**
   * @property {object} source  The source from which messages are received.
   */
  source?: TerminusOptions;
  /**
   * @property {object} [target]  The target of a receiving link is the local identifier
   */
  target?: TerminusOptions;
}

/**
 * Defines the options that can be set while creating the Sender (link).
 * @interface SenderOptions
 * @extends LinkOptions
 */
export interface SenderOptions extends LinkOptions {
  /**
   * @property {boolean} [autosettle] Whether sent messages should be automatically settled once the peer settles them. Defaults to true.
   */
  autosettle?: boolean;
  /**
   * @property {object} target  - The target to which messages are sent
   */
  target?: TerminusOptions;
  /**
   * @property {object} [source]  The source of a sending link is the local identifier
   */
  source?: TerminusOptions;
}
/**
 * Provides a Dictionary like structure <Key, Value> of Type T.
 * @interface Dictionary
 */
export interface Dictionary<T> {
  [key: string]: T;
}

/**
 * Map containing message attributes that will be held in the message header.
 */
export interface AmqpMessageAnnotations {
  /**
   * @property {string | null} [x-opt-partition-key] Annotation for the partition key set for the event.
   */
  "x-opt-partition-key"?: string | null;
  /**
   * @property {number} [x-opt-sequence-number] Annontation for the sequence number of the event.
   */
  "x-opt-sequence-number"?: number;
  /**
   * @property {number} [x-opt-enqueued-time] Annotation for the enqueued time of the event.
   */
  "x-opt-enqueued-time"?: number;
  /**
   * @property {string} [x-opt-offset] Annotation for the offset of the event.
   */
  "x-opt-offset"?: string;
  /**
   * @property {any} Any other annotation that can be added to the message.
   */
  [x: string]: any;
}

/**
 * Describes the delivery annotations.
 * @interface
 */
export interface DeliveryAnnotations {
  /**
   * @property {string} [last_enqueued_offset] The offset of the last event.
   */
  last_enqueued_offset?: string;
  /**
   * @property {number} [last_enqueued_sequence_number] The sequence number of the last event.
   */
  last_enqueued_sequence_number?: number;
  /**
   * @property {number} [last_enqueued_time_utc] The enqueued time of the last event.
   */
  last_enqueued_time_utc?: number;
  /**
   * @property {number} [runtime_info_retrieval_time_utc] The retrieval time of the last event.
   */
  runtime_info_retrieval_time_utc?: number;
  /**
   * @property {string} Any unknown delivery annotations.
   */
  [x: string]: any;
}

/**
 * Describes the defined set of standard properties of the message.
 * @interface AmqpMessageProperties
 */
export interface AmqpMessageProperties {
  /**
   * @property {string} [message_id] The application message identifier that uniquely idenitifes a message.
   * The user is responsible for making sure that this is unique in the given context. Guids usually make a good fit.
   */
  message_id?: string;
  /**
   * @property {string} [reply_to] The address of the node to send replies to.
   */
  reply_to?: string;
  /**
   * @property {string} [to] The address of the node the message is destined for.
   */
  to?: string;
  /**
   * @property {string} [correlation_id] The id that can be used to mark or identify messages between clients.
   */
  correlation_id?: string;
  /**
   * @property {string} [content_type] MIME type for the message.
   */
  content_type?: string;
  /**
   * @property {string} [content_encoding] The content-encoding property is used as a modifier to the content-type.
   * When present, its valueindicates what additional content encodings have been applied to the application-data.
   */
  content_encoding?: string;
  /**
   * @property {number} [absolute_expiry_time] The time when this message is considered expired.
   */
  absolute_expiry_time?: number;
  /**
   * @property {number} [creation_time] The time this message was created.
   */
  creation_time?: number;
  /**
   * @property {string} [group_id] The group this message belongs to.
   */
  group_id?: string;
  /**
   * @property {number} [group_sequence] The sequence number of this message with its group.
   */
  group_sequence?: number;
  /**
   * @property {string} [reply_to_group_id] The group the reply message belongs to.
   */
  reply_to_group_id?: string;
}

/**
 * Describes the AMQP message that is sent or received on the wire.
 * @interface AmqpMessage
 */
export interface AmqpMessage extends AmqpMessageProperties {
  // TODO: Ask Gordon about other AMQP message properties like durable, first_acquirer, etc.
  // https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-amqp-protocol-guide#messages
  body: any;
  message_annotations?: AmqpMessageAnnotations;
  application_properties?: Dictionary<any>;
  delivery_annotations?: DeliveryAnnotations;
}

/**
 * Defines the AMQP Connection context. This context is provided when you add an
 * event handler to any of the objects created by rhea.
 * @interface Context
 */
export interface Context {
  /**
   * @property {Connection} connection The amqp connection.
   */
  connection: any;
  /**
   * @property {Container} container The amqp container
   */
  container: any;
  /**
   * @property {Delivery} [delivery] The amqp delivery that is received after sending a message.
   */
  delivery?: Delivery;
  /**
   * @property {AmqpMessage} [message] The amqp message that is received in the message event
   * handler when rhea emits a message event on a receiver.
   */
  message?: AmqpMessage;
  /**
   * @property {Receiver} [receiver] The amqp receiver link that was created on the amqp connection.
   */
  receiver?: any;
  /**
   * @property {Session} session The amqp session link that was created on the amqp connection.
   */
  session: any;
  /**
   * @property {Sender} [sender] The amqp sender link that was created on the amqp connection.
   */
  sender?: any;
}

/**
 * Defines the amqp error object.
 * @interface AmqpError
 */
export interface AmqpError {
  /**
   * @property {string} [condition] Describes the error condition.
   */
  condition?: string;
  /**
   * @property {string} [description] Describes any supplementary information that is not indicated the error condition.
   */
  description?: string;
  /**
   * @property {any} [info] Describes the information about the error condition.
   */
  info?: any;
  /**
   * @property {any[]} [value] Describes the associated amqp value types.
   */
  value?: any[];
}

export declare class Connection extends EventEmitter {
  registered: boolean;
  state: EndpointState;
  local_channel_map: { [x: string]: Session };
  remote_channel_map: { [x: string]: Session };
  local: any;
  remote: any;
  session_policy: any;
  amqp_transport: Transport;
  sasl_transport?: any;
  conn_established_counter: number;
  heartbeat_out: NodeJS.Timer;
  heartbeat_in: NodeJS.Timer;
  abort_idle: boolean;
  socket_ready: boolean;
  scheduled_reconnect?: NodeJS.Timer;
  default_sender?: Sender;
  readonly error?: any;
  transport_error: {
    condition: "amqp:unauthorized-access";
    description: string;
  }
  constructor(options: ConnectionOptions, container: Container);
  dispatch(name: string): boolean;
  reset(): void;
  connect(): Connection;
  reconnect(): Connection;
  _connect(): Connection;
  accept(socket: Socket): Connection;
  init(socket: Socket): Connection;
  attach_sender(options?: SenderOptions): Sender;
  open_sender(options?: SenderOptions): Sender;
  attach_receiver(options?: ReceiverOptions): Receiver;
  open_receiver(options?: ReceiverOptions): Receiver;
  get_option(name: string, default_value: any): any;
  send(msg: any): Delivery;
  connected(): void;
  sasl_failed(tesxt: string): void;
  _is_fatal(error_condition: string): boolean;
  _handle_error(): void;
  get_error(): AmqpError | undefined;
  _get_peer_details(): string;
  output(): void;
  input(buff: Buffer): void;
  idle(): void;
  on_error(e: any): void;
  eof(): void;
  _disconnected(error: any): void;
  open(): void;
  close(): void;
  is_open(): boolean;
  is_remote_open(): boolean;
  is_closed(): boolean;
  create_session(): Session;
  find_sender(filter: Function): Sender | undefined;
  find_receiver(filter: Function): Receiver | undefined;
  find_link(filter: Function): link | undefined;
  each_receiver(action: Function, filter?: Function): void;
  each_sender(action: Function, filter?: Function): void;
  each_link(action: Function, filter?: Function): void;
  on_open(frame: frames): void;
  on_close(frame: frames): void;
  _register(): void;
  _process(): void;
  _write_frame(channel: any, frame: frames, payload?: any): void;
  _write_open(): void;
  _write_closed(): void;
  on_begin(frame: frames): void;
  get_peer_certificate(): any | undefined;
  get_tls_socket(): Socket | undefined;
  _context(c: any): any | undefined;
  remove_session(session: Session): void;
  on_end(frame: frames): void;
  on_attach(frame: frames): void;
  on_detach(frame: frames): void;
  on_transfer(frame: frames): void;
  on_disposition(frame: frames): void;
  on_flow(frame: frames): void;
}
