/// <reference types="node" />

import { sasl } from "./sasl";
import {generate_uuid, string_to_uuid, uuid_to_string} from "./util";
import { ws } from "./ws";
import { filter } from "./filter";
import { EventEmitter } from "events";
import { Connection } from "./connection";
import { ListenOptions, Server, Socket } from "net";
import { TlsOptions, Server as TlsServer, ConnectionOptions } from "tls";
import { message } from "./message";
import { types } from "./types";

interface ContainerOptions {
  id?: string;
  non_fatal_errors?: any[];
  [x: string]: any;
}

export declare interface IContainer extends EventEmitter {
  options: ContainerOptions;
  id: string;
  sasl_server_mechanisms: any;
  dispatch(name: string): boolean;
  connect(options?: any): Connection;
  listen(options: ListenOptions | TlsOptions): Server | TlsServer;
  create_container(options?: ContainerOptions): IContainer;
  get_option(name: string, default_value: any): any;
  generate_uuid: generate_uuid;
  string_to_uuid: string_to_uuid;
  uuid_to_string: uuid_to_string;
  rpc_server(address: string, options?: any): any;
  rpc_client(address: string): any;
  websocket_accept(socket: Socket, options: ConnectionOptions): void;
  websocket_connect: ws.connect;
  filter: filter;
  types: types;
  message: message;
  sasl: sasl;
}

export declare class Container extends EventEmitter implements IContainer {
  constructor(options?: ContainerOptions);
  options: ContainerOptions;
  id: string;
  sasl_server_mechanisms: any;
  dispatch(name: string): boolean;
  connect(options?: any): Connection;
  listen(options: ListenOptions | TlsOptions): Server | TlsServer;
  create_container(options?: ContainerOptions): IContainer;
  get_option(name: string, default_value: any): any;
  generate_uuid: generate_uuid;
  string_to_uuid: string_to_uuid;
  uuid_to_string: uuid_to_string;
  rpc_server(address: string, options?: any): any;
  rpc_client(address: string): any;
  websocket_accept(socket: Socket, options: ConnectionOptions): void;
  websocket_connect: ws.connect;
  filter: filter;
  types: types;
  message: message;
  sasl: sasl;
}

