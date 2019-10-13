import { Readable, Writable } from "stream";
import { Receiver, Sender } from "./link";

export declare interface ReceiverStream extends Readable {
    link: Receiver
}

export declare interface SenderStream extends Writable {
    link: Sender
}
