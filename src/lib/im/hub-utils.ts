/** What HuLa's Rust client sends every 9.9s (`WsMessage::Heartbeat`), byte for byte. */
export const IM_HEARTBEAT_REQUEST = '{"type":"2"}';
/** HuLa only checks the type of the pong, so a constant works for the hibernation auto-response. */
export const IM_HEARTBEAT_RESPONSE = '{"type":"3","timestamp":0}';

export interface ImSocketAttachment {
	userId: string;
	clientId: string;
	connectedAt: number;
}

/** A server push in HuLa's shape: `type` is an event name from its `WsResponseMessageType`. */
export interface ImSocketEvent {
	type: string;
	data: unknown;
}
