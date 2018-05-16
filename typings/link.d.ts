/// <reference types="node" />

import { EventEmitter } from "events";
import { frames } from "./frames";
import { EndpointState } from "./endpoint";
import { Delivery, Session } from "./session";
import { Context, AmqpMessage } from "./connection";

export declare interface FlowController {
  window: number;
  update(context: Context): void;
}

export declare interface LinkError extends Error {
  message: string;
  condition: any;
  link: any;
}

export declare interface ILocal {
  handle: any;
  attach: {
    source?: any;
    target?: any;
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
  connection: any;
  name: string;
  options: any;
  state: EndpointState;
  issue_flow: boolean;
  local: ILocal;
  remote: any;
  delivery_count: number;
  credit: number;
  observers: EventEmitter;
  error: any;
  snd_settle_mode: any;
  rcv_settle_mode: any;
  source: any;
  target: any;
  max_message_size: any;
  offered_capabilities: any;
  desired_capabilities: any;
  properties: any;
  dispatch(name: string): boolean;
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
  on_attach(frame: frames): void;
  prefix_event(event: string): string;
  on_detach(frame: frames): void;
  reset(): void;
  has_credit(): boolean;
  is_receiver(): boolean;
  is_sender(): boolean;
  get_option(name: string, default_value: any): any;
}

export declare interface Sender extends link {
  tag: number;
  _draining: boolean;
  _drained: boolean;
  _get_drain(): boolean;
  set_drained(drained: any): void;
  next_tag(): Buffer;
  sendable(): boolean;
  on_flow(frame: frames): void;
  on_transfer(): void;
  send(msg: AmqpMessage | Buffer, tag?: Buffer, format?: number): Delivery;
}

export declare interface Receiver extends link {
  session: Session;
  name: string;
  local_handle: any;
  opts: any;
  drain: boolean;
  on_flow(frame: frames): void;
  flow(credit: number): void;
  add_credit(credit: number): void;
  _get_drain(): boolean;
  set_credit_window(credit_window: number): void;
}

