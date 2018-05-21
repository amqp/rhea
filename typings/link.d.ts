/// <reference types="node" />

import { EventEmitter } from "events";
import { frames } from "./frames";
import { EndpointState } from "./endpoint";
import { Delivery, Session } from "./session";
import { EventContext, Message, TerminusOptions, Connection, LinkOptions, Source } from "./connection";

export declare interface FlowController {
  window: number;
  update(context: EventContext): void;
}

export declare interface LinkError extends Error {
  message: string;
  condition: any;
  link: link;
}

export declare interface ILocal {
  handle: any;
  attach: {
    role: boolean;
    initial_delivery_count?: number;
    snd_settle_mode?: number;
    [x: string]: any;
  };
  detach: {
    closed?: boolean;
    error?: any;
    [x: string]: any;
  }
}

export declare interface link extends EventEmitter {
  init(session: Session, name: string, local_handle: any, opts: any, is_receiver: boolean): void;
  session: Session;
  connection: Connection;
  name: string;
  options: LinkOptions;
  local: ILocal;
  remote: any;
  readonly error: any;
  readonly snd_settle_mode: 0 | 1 | 2;
  readonly rcv_settle_mode: 0 | 1;
  readonly source: Source;
  readonly target: TerminusOptions;
  readonly max_message_size: any;
  readonly offered_capabilities: string | string[];
  readonly desired_capabilities: string | string[];
  readonly properties: any;
  set_source(fields: any): void;
  set_target(fields: any): void;
  attach(): void;
  open(): void;
  detach(): void;
  close(error?: any): void;
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
  set_drained(drained: any): void;
  sendable(): boolean;
  send(msg: Message | Buffer, tag?: Buffer, format?: number): Delivery;
}

export declare interface Receiver extends link {
  local_handle: any;
  opts: any;
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