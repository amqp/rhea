/// <reference types="node" />

import { Container } from "./container";
import { Connection, Context } from "./connection";
import { Sender, Receiver, link } from "./link";

interface IdGenerator {
  counter: number;
  next(): number;
}
declare class Client {
  connection: Connection;
  sender: Sender;
  receiver: Receiver;
  id_generator: IdGenerator;
  pending: any[];
  outstanding: any;
  constructor(container: Container, address: string);
  _request(id: string | number, name: string, args: any, callback: Function): void;
  _response(context: Context): void;
  _ready(): void;
  _process_pending(): void;
  call(name: string, args: any, callback: Function): void;
  close(): void;
  define(name: string): void;
}

declare class Cache {
  entries: any;
  timeout?: any;
  ttl: number;
  purged: (link: link) => void;
  constructor(ttl: number, purged: (link: link) => void);
  clear(): void;
  put(key: string, value: any): void;
  get(key: string): any | undefined;
  purge(): void;
}

declare class LinkCache {
  factory: any;
  cache: Cache;
  constructor(factory: any, ttl: number);
  get(address: string): link;
}

declare class Server {
  container: Container;
  address: string;
  options: any;
  connection: Connection;
  receiver: Receiver;
  callbacks: any;
  _send?: any;
  _clear?: any;
  constructor(container: Container, address: string, options: any);
  _connection_open(): void;
  _respond(response: { subject: string, body: any, [x: string]: any }): void;
  _request(context: Context): void;
  bind_sync(f: Function, name: string): void;
  bind(f: Function, name: string): void;
  close(): void;
}

export const server: (container: Container, address: string, options: any) => Server;
export const client: (connection: Connection, address: string) => Client;