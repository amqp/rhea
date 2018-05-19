/// <reference types="node" />

import { Connection, EventContext } from "./connection";
import { EndpointState } from "./endpoint";
import { EventEmitter } from "events";
import { link, Sender, Receiver } from "./link";
import { frames } from "./frames";
import { AmqpError } from ".";

export declare interface Delivery {
  readonly format: number;
  readonly id: number;
  readonly tag: Buffer;
  readonly link: any;
  readonly remote_settled: boolean;
  readonly sent: boolean;
  readonly settled: boolean;
  readonly state?: any;
  readonly remote_state?: any;
  update(settled: boolean, state?: any): void;
  accept(): void;
  release(params?: any): void;
  reject(error: AmqpError): void;
  modified?(params: any): void;
}

export declare interface CircularBuffer {
  capacity: number;
  size: number;
  head: number;
  tail: number;
  entries: any[];
  available(): number;
  push(o: any): void;
  pop_if(f: Function): number;
  by_id(id: number): any | undefined;
  get_head(): any | undefined;
  get_tail(): any | undefined;
}

export declare interface Outgoing {
  deliveries: CircularBuffer;
  updated: any[];
  pending_dispositions: any[];
  next_delivery_id: number;
  next_pending_delivery: number;
  next_transfer_id: number;
  window: number;
  remote_next_transfer_id?: any;
  remote_window?: any;
  connection: Connection;
  available(): number;
  compute_max_payload(tag: Buffer): number;
  send(sender: any, tag: Buffer, data: any, format: any): Delivery;
  on_begin(fields: any): void;
  on_flow(fields: any): void;
  on_disposition(fields: any): void;
  update(delivery: Delivery, settled: boolean, state: EndpointState): void;
  transfer_window(): number;
  process(): void;
}

export declare interface Incoming {
  readonly window: number;
  deliveries: CircularBuffer;
  updated: any[];
  next_transfer_id: number;
  next_delivery_id?: any;
  remote_next_transfer_id?: any;
  remote_window?: any;
  max_transfer_id: number;
  update(delivery: Delivery, settled: boolean, state: EndpointState): void;
  on_transfer(frame: frames, receiver: Receiver): void;
  process(session: Session): void;
  on_begin(fields: any): void;
  on_flow(fields: any): void;
  on_disposition(fields: any): void;
}

export declare interface Session extends EventEmitter {
  connection: Connection;
  options: any;
  reset(): void;
  get_option(name: string, default_value: any): any;
  attach_sender(args: any): Sender;
  open_sender(args: any): Sender;
  attach_receiver(args: any): Receiver;
  open_receiver(args: any): Receiver;
  find_link(filter: Function): link | undefined;
  find_sender(filter: Function): Sender | undefined;
  find_receiver(filter: Function): Receiver | undefined;
  each_receiver(action: Function, filter: Function): void;
  each_sender(action: Function, filter: Function): void;
  each_link(action: Function, filter: Function): void;
  begin(): void;
  open(): void;
  end(error?: Error): void;
  close(error?: Error): void;
  is_open(): boolean;
  is_remote_open(): boolean;
  is_closed(): boolean;
  remove(): void;
}
