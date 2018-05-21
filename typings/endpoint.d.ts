/// <reference types="node" />

export declare interface EndpointState {
  local_open: boolean;
  remote_open: boolean;
  open_requests: number;
  close_requests: number;
  initialised: boolean;
  init(): void;
  open(): boolean;
  close(): boolean;
  disconnected(): void;
  remote_opened(): boolean;
  remote_closed(): boolean;
  is_open(): boolean;
  is_closed(): boolean;
  has_settled(): boolean;
  need_open(): boolean;
  need_close(): boolean;
}