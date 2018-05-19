/// <reference types="node" />

export declare interface Message {
  [x: string]: any;
  toJSON: () => {
    [x: string]: any;
  };
  inspect: () => string;
  toString: () => string;
}

export interface message {
  data_section: (data: any) => any;
  sequence_section: (list: any) => any;
  data_sections: (data_elements: any) => any;
  sequence_sections: (lists: any) => any;
  encode: (msg: any) => any;
  decode: (buffer: Buffer) => Message;
  are_outcomes_equivalent: (a: any, b: any) => boolean;
  is_received: (o: any) => boolean;
  is_accepted: (o: any) => boolean;
  is_rejected: (o: any) => boolean;
  is_released: (o: any) => boolean;
  is_modified: (o: any) => boolean;
}
