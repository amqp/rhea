/// <reference types="node" />

import { CreateTypeDesc } from "./types";

declare class Section {
  typecode: number;
  content: any;
  multiple: any;
  constructor(typecode: number, content: any, multiple: any);
  described(item: any): any;
}

declare interface Message {
  [x: string]: any;
  toJSON: () => {
    [x: string]: any;
  };
  inspect: () => string;
  toString: () => string;
}

export namespace message {
  export const data_section: (data: any) => Section;
  export const sequence_section: (list: any) => Section;
  export const data_sections: (data_elements: any) => Section;
  export const sequence_sections: (lists: any) => Section;
  export const encode: (msg: any) => any;
  export const decode: (buffer: Buffer) => Message;
  export const unwrap_outcome: (outcome: any) => any;
  export const are_outcomes_equivalent: (a: any, b: any) => boolean;
  export const header: CreateTypeDesc;
  export const properties: CreateTypeDesc;
  export const received: CreateTypeDesc;
  export const accepted: CreateTypeDesc;
  export const rejected: CreateTypeDesc;
  export const released: CreateTypeDesc;
  export const modified: CreateTypeDesc;
  export const is_received: (o: any) => boolean;
  export const is_accepted: (o: any) => boolean;
  export const is_rejected: (o: any) => boolean;
  export const is_released: (o: any) => boolean;
  export const is_modified: (o: any) => boolean;
}

export interface message {
  data_section: (data: any) => Section;
  sequence_section: (list: any) => Section;
  data_sections: (data_elements: any) => Section;
  sequence_sections: (lists: any) => Section;
  encode: (msg: any) => any;
  decode: (buffer: Buffer) => Message;
  unwrap_outcome: (outcome: any) => any;
  are_outcomes_equivalent: (a: any, b: any) => boolean;
  header: CreateTypeDesc;
  properties: CreateTypeDesc;
  received: CreateTypeDesc;
  accepted: CreateTypeDesc;
  rejected: CreateTypeDesc;
  released: CreateTypeDesc;
  modified: CreateTypeDesc;
  is_received: (o: any) => boolean;
  is_accepted: (o: any) => boolean;
  is_rejected: (o: any) => boolean;
  is_released: (o: any) => boolean;
  is_modified: (o: any) => boolean;
}
