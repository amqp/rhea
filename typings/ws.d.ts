/// <reference types="node" />

export namespace ws {
  export type connect = (Impl: any) => (url: any, protocols: any, options: any) => () => {
    [x: string]: any;
    connect: (port_ignore: any, host_ignore: any, options_ignore: any, callback: Function) => {
      [x: string]: any;
      end: () => void;
      write: (data: any) => void;
      on: (event: string, handler: Function) => void;
      get_id_string: () => string;
    }
  };
  export type wrap = (ws: any) => {
    [x: string]: any;
    end: () => void;
    write: (data: any) => void;
    on: (event: string, handler: Function) => void;
    get_id_string: () => string;
  }
}
