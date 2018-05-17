/// <reference types="node" />

import { EventEmitter } from "events";
import { frames } from "./frames";
import { EndpointState } from "./endpoint";
import { Delivery, Session } from "./session";
import { EventContext, AmqpMessage, TerminusOptions, Connection, LinkOptions, Source } from "./connection";

export declare interface FlowController {
  window: number;
  update(context: EventContext): void;
}

export declare interface LinkError extends Error {
  message: string;
  condition: any;
  link: any;
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
  readonly offered_capabilities: any;
  readonly desired_capabilities: any;
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
  send(msg: AmqpMessage | Buffer, tag?: Buffer, format?: number): Delivery;
}

export declare interface Receiver extends link {
  local_handle: any;
  opts: any;
  drain: boolean;
  add_credit(credit: number): void;
  set_credit_window(credit_window: number): void;
}

