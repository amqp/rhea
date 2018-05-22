/// <reference types="node" />

import { EventEmitter } from "events";
import { frames } from "./frames";
import { EndpointState } from "./endpoint";
import { Delivery, Session } from "./session";
import { EventContext, Message, TerminusOptions, Connection, LinkOptions, Source, AmqpError, Dictionary } from "./connection";

export declare interface FlowController {
  window: number;
  update(context: EventContext): void;
}

export declare interface LinkError extends Error {
  message: string;
  condition: any;
  link: link;
}

export declare interface link extends EventEmitter {
  init(session: Session, name: string, local_handle: any, opts: any, is_receiver: boolean): void;
  session: Session;
  connection: Connection;
  name: string;
  options: LinkOptions;
  readonly error?: AmqpError | Error;
  readonly snd_settle_mode: 0 | 1 | 2;
  readonly rcv_settle_mode: 0 | 1;
  readonly source: Source;
  readonly target: TerminusOptions;
  readonly max_message_size: number;
  readonly offered_capabilities: string | string[];
  readonly desired_capabilities: string | string[];
  readonly properties: Dictionary<any>;
  set_source(fields: Source): void;
  set_target(fields: TerminusOptions): void;
  attach(): void;
  open(): void;
  detach(): void;
  close(error?: AmqpError): void;
  remove(): void;
  is_open(): boolean;
  is_remote_open(): boolean;
  is_closed(): boolean;
  reset(): void;
  has_credit(): boolean;
  is_receiver(): boolean;
  is_sender(): boolean;
  get_option(name: string, default_value: any): any;
}

export declare interface Sender extends link {
  set_drained(drained: boolean): void;
  /**
   * Determines whether the message is sendable.
   * @returns {boolean} `true` Sendable. `false` Not Sendable.
   */
  sendable(): boolean;
  /**
   * Sends a message
   * @param {Message | Buffer} msg The message to be sent. For default AMQP format msg parameter
   * should be of type Message interface. For a custom format, the msg parameter should be a Buffer.
   * @param {Buffer | string} [tag] The message tag if any.
   * @param {number} [format] The message format. Usually it is zero. Specify this
   * if a message with custom format needs to be sent.
   * @returns {Delivery} Delivery
   */
  send(msg: Message | Buffer, tag?: Buffer | string, format?: number): Delivery;
}

export declare interface Receiver extends link {
  drain: boolean;
  add_credit(credit: number): void;
  set_credit_window(credit_window: number): void;
}

export declare enum ReceiverEvents {
  /**
   * @property {string} message Raised when a message is received.
   */
  message = "message",
  /**
   * @property {string} receiverOpen Raised when the remote peer indicates the link is
   * open (i.e. attached in AMQP parlance).
   */
  receiverOpen = "receiver_open",
  /**
   * @property {string} receiverError Raised when the remote peer receives an error. The context
   * may also have an error property giving some information about the reason for the error.
   */
  receiverError = "receiver_error",
  /**
   * @property {string} receiverClose Raised when the remote peer indicates the link is closed.
   */
  receiverClose = "receiver_close"
}

export declare enum SenderEvents {
  /**
   * @property {string} sendable Raised when the sender has sufficient credit to be able
   * to transmit messages to its peer.
   */
  sendable = "sendable",
  /**
   * @property {string} senderOpen Raised when the remote peer indicates the link is
   * open (i.e. attached in AMQP parlance).
   */
  senderOpen = "sender_open",
  /**
   * @property {string} senderError Raised when the remote peer receives an error. The context
   * may also have an error property giving some information about the reason for the error.
   */
  senderError = "sender_error",
  /**
   * @property {string} senderClose Raised when the remote peer indicates the link is closed.
   */
  senderClose = "sender_close",
  /**
   * @property {string} accepted Raised when a sent message is accepted by the peer.
   */
  accepted = "accepted",
  /**
   * @property {string} released Raised when a sent message is released by the peer.
   */
  released = "released",
  /**
   * @property {string} rejected Raised when a sent message is rejected by the peer.
   */
  rejected = "rejected",
}
