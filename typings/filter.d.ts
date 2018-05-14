/// <reference types="node" />

import * as types from "./types";

export interface filter {
  selector: (s: any) => {
    'jms-selector': types.Typed;
  };
}

export namespace filter {
  export const selector: (s: any) => {
    'jms-selector': types.Typed;
  };
}
