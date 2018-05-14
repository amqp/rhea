/// <reference types="node" />

import { EventEmitter } from "events";
import { frames } from "./frames";
import { EndpointState } from "./endpoint";
import { Delivery } from "./session";

declare class FlowController {
  window: number;
  constructor(window: number);
  update(context: any): void;
}

declare class LinkError extends Error {
  message: string;
  condition: any;
  link: any;
  constructor(message: string, condition: any, link: any);
}

declare class link extends EventEmitter {
  session: any;
  connection: any;
  name: string;
  options: any;
  state: EndpointState;
  issue_flow: boolean;
  local: any;
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
  constructor();
  dispatch(name: string): boolean;
  set_source(fields: any[]): void;
  set_target(fields: any[]): void;
  attach(): void;
  open(): void;
  detach(): void;
  close(error: any): void;
  remove(): void;
  is_open(): boolean;
  is_remote_open(): boolean;
  is_closed(): boolean;
  on_attach(frame: frames): void;
  prefix_event(event: string): string;
  on_detach(frame: frames): void;
  init(session: any, name: string, local_handle: any, opts: any, is_receiver: boolean): any;
  reset(): void;
  has_credit(): boolean;
  is_receiver(): boolean;
  is_sender(): boolean;
  get_option(name: string, default_value: any): any;
}

export declare class Sender extends link {
  tag: number;
  private _draining: boolean;
  private _drained: boolean;
  constructor(session: any, name: string, local_handle: any, opts: any);
  _get_drain(): boolean;
  set_drained(drained: any): void;
  next_tag(): Buffer;
  sendable(): boolean;
  on_flow(frame: frames): void;
  on_transfer(): void;
  send(msg: any, tag: Buffer, format: number): Delivery;
}

export declare class Receiver extends link {
  session: any;
  name: string;
  local_handle: any;
  opts: any;
  drain: boolean;
  constructor(session: any, name: string, local_handle: any, opts: any, is_receiver: boolean);
  on_flow(frame: frames): void;
  flow(credit: number): void;
  add_credit(credit: number): void;
  _get_drain(): boolean;
  set_credit_window(credit_window: number): void;
}
