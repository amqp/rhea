/// <reference types="node" />

import { CreateTypeDesc } from "./types";

export declare class Section {
  typecode: number;
  content: any;
  multiple: any;
  constructor(typecode: number, content: any, multiple: any);
  described(item: any): any;
}

export declare interface Message {
  [x: string]: any;
  toJSON: () => {
    [x: string]: any;
  };
  inspect: () => string;
  toString: () => string;
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
