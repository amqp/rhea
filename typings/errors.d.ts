/// <reference types="node" />

export declare class ProtocolError extends Error {
    message: string;
    name: string;
    constructor(message: string);
}
export declare class TypeError extends ProtocolError {
    message: string;
    name: string;
    constructor(message: string);
}
export declare class ConnectionError extends Error {
    message: string;
    name: string;
    description: string;
    condition: any;
    connection: any;
    constructor(message: string, condition: any, connection: any);
}
