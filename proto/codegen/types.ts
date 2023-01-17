/* eslint-disable @typescript-eslint/no-redeclare */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-bitwise */
import * as _m0 from 'protobufjs/minimal';
import { Long, DeepPartial } from './helpers';

export interface TxResult {
  height: Long;
  index: number;
  tx: Uint8Array;
  result?: ResponseDeliverTx;
}
export interface TxResultSDKType {
  height: Long;
  index: number;
  tx: Uint8Array;
  result?: ResponseDeliverTxSDKType;
}
export interface ResponseDeliverTx {
  code: number;
  data: Uint8Array;
  /** nondeterministic */

  log: string;
  /** nondeterministic */

  info: string;
  gasWanted: Long;
  gasUsed: Long;
  /** nondeterministic */

  events: Event[];
  codespace: string;
}
export interface ResponseDeliverTxSDKType {
  code: number;
  data: Uint8Array;
  /** nondeterministic */

  log: string;
  /** nondeterministic */

  info: string;
  gas_wanted: Long;
  gas_used: Long;
  /** nondeterministic */

  events: EventSDKType[];
  codespace: string;
}
export interface Event {
  type: string;
  attributes: EventAttribute[];
}
export interface EventSDKType {
  type: string;
  attributes: EventAttributeSDKType[];
}
/** EventAttribute is a single key-value pair, associated with an event. */

export interface EventAttribute {
  key: string;
  value: string;
  /** nondeterministic */

  index: boolean;
}
/** EventAttribute is a single key-value pair, associated with an event. */

export interface EventAttributeSDKType {
  key: string;
  value: string;
  /** nondeterministic */

  index: boolean;
}
export interface User {
  name: string;
  age: number;
}
export interface UserSDKType {
  name: string;
  age: number;
}

function createBaseTxResult(): TxResult {
  return {
    height: Long.ZERO,
    index: 0,
    tx: new Uint8Array(),
    result: undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const TxResult = {
  encode(
    message: TxResult,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (!message.height.isZero()) {
      writer.uint32(8).int64(message.height);
    }

    if (message.index !== 0) {
      writer.uint32(16).uint32(message.index);
    }

    if (message.tx.length !== 0) {
      writer.uint32(26).bytes(message.tx);
    }

    if (message.result !== undefined) {
      ResponseDeliverTx.encode(
        message.result,
        writer.uint32(34).fork()
      ).ldelim();
    }

    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): TxResult {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    const end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTxResult();

    while (reader.pos < end) {
      const tag = reader.uint32();

      // eslint-disable-next-line no-bitwise
      switch (tag >>> 3) {
        case 1:
          message.height = reader.int64() as Long;
          break;

        case 2:
          message.index = reader.uint32();
          break;

        case 3:
          message.tx = reader.bytes();
          break;

        case 4:
          message.result = ResponseDeliverTx.decode(reader, reader.uint32());
          break;

        default:
          // eslint-disable-next-line no-bitwise
          reader.skipType(tag & 7);
          break;
      }
    }

    return message;
  },

  fromPartial(object: DeepPartial<TxResult>): TxResult {
    const message = createBaseTxResult();
    message.height =
      object.height !== undefined && object.height !== null
        ? Long.fromValue(object.height)
        : Long.ZERO;
    message.index = object.index ?? 0;
    message.tx = object.tx ?? new Uint8Array();
    message.result =
      object.result !== undefined && object.result !== null
        ? ResponseDeliverTx.fromPartial(object.result)
        : undefined;
    return message;
  },
};

function createBaseResponseDeliverTx(): ResponseDeliverTx {
  return {
    code: 0,
    data: new Uint8Array(),
    log: '',
    info: '',
    gasWanted: Long.ZERO,
    gasUsed: Long.ZERO,
    events: [],
    codespace: '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const ResponseDeliverTx = {
  encode(
    message: ResponseDeliverTx,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.code !== 0) {
      writer.uint32(8).uint32(message.code);
    }

    if (message.data.length !== 0) {
      writer.uint32(18).bytes(message.data);
    }

    if (message.log !== '') {
      writer.uint32(26).string(message.log);
    }

    if (message.info !== '') {
      writer.uint32(34).string(message.info);
    }

    if (!message.gasWanted.isZero()) {
      writer.uint32(40).int64(message.gasWanted);
    }

    if (!message.gasUsed.isZero()) {
      writer.uint32(48).int64(message.gasUsed);
    }

    for (const v of message.events) {
      Event.encode(v!, writer.uint32(58).fork()).ldelim();
    }

    if (message.codespace !== '') {
      writer.uint32(66).string(message.codespace);
    }

    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ResponseDeliverTx {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    const end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseResponseDeliverTx();

    while (reader.pos < end) {
      const tag = reader.uint32();

      switch (tag >>> 3) {
        case 1:
          message.code = reader.uint32();
          break;

        case 2:
          message.data = reader.bytes();
          break;

        case 3:
          message.log = reader.string();
          break;

        case 4:
          message.info = reader.string();
          break;

        case 5:
          message.gasWanted = reader.int64() as Long;
          break;

        case 6:
          message.gasUsed = reader.int64() as Long;
          break;

        case 7:
          message.events.push(Event.decode(reader, reader.uint32()));
          break;

        case 8:
          message.codespace = reader.string();
          break;

        default:
          reader.skipType(tag & 7);
          break;
      }
    }

    return message;
  },

  fromPartial(object: DeepPartial<ResponseDeliverTx>): ResponseDeliverTx {
    const message = createBaseResponseDeliverTx();
    message.code = object.code ?? 0;
    message.data = object.data ?? new Uint8Array();
    message.log = object.log ?? '';
    message.info = object.info ?? '';
    message.gasWanted =
      object.gasWanted !== undefined && object.gasWanted !== null
        ? Long.fromValue(object.gasWanted)
        : Long.ZERO;
    message.gasUsed =
      object.gasUsed !== undefined && object.gasUsed !== null
        ? Long.fromValue(object.gasUsed)
        : Long.ZERO;
    message.events = object.events?.map((e) => Event.fromPartial(e)) || [];
    message.codespace = object.codespace ?? '';
    return message;
  },
};

function createBaseEvent(): Event {
  return {
    type: '',
    attributes: [],
  };
}

export const Event = {
  encode(message: Event, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.type !== '') {
      writer.uint32(10).string(message.type);
    }

    for (const v of message.attributes) {
      EventAttribute.encode(v!, writer.uint32(18).fork()).ldelim();
    }

    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Event {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    const end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseEvent();

    while (reader.pos < end) {
      const tag = reader.uint32();

      switch (tag >>> 3) {
        case 1:
          message.type = reader.string();
          break;

        case 2:
          message.attributes.push(
            EventAttribute.decode(reader, reader.uint32())
          );
          break;

        default:
          reader.skipType(tag & 7);
          break;
      }
    }

    return message;
  },

  fromPartial(object: DeepPartial<Event>): Event {
    const message = createBaseEvent();
    message.type = object.type ?? '';
    message.attributes =
      object.attributes?.map((e) => EventAttribute.fromPartial(e)) || [];
    return message;
  },
};

function createBaseEventAttribute(): EventAttribute {
  return {
    key: '',
    value: '',
    index: false,
  };
}

export const EventAttribute = {
  encode(
    message: EventAttribute,
    writer: _m0.Writer = _m0.Writer.create()
  ): _m0.Writer {
    if (message.key !== '') {
      writer.uint32(10).string(message.key);
    }

    if (message.value !== '') {
      writer.uint32(18).string(message.value);
    }

    if (message.index === true) {
      writer.uint32(24).bool(message.index);
    }

    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): EventAttribute {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    const end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseEventAttribute();

    while (reader.pos < end) {
      const tag = reader.uint32();

      switch (tag >>> 3) {
        case 1:
          message.key = reader.string();
          break;

        case 2:
          message.value = reader.string();
          break;

        case 3:
          message.index = reader.bool();
          break;

        default:
          reader.skipType(tag & 7);
          break;
      }
    }

    return message;
  },

  fromPartial(object: DeepPartial<EventAttribute>): EventAttribute {
    const message = createBaseEventAttribute();
    message.key = object.key ?? '';
    message.value = object.value ?? '';
    message.index = object.index ?? false;
    return message;
  },
};

function createBaseUser(): User {
  return {
    name: '',
    age: 0,
  };
}

export const User = {
  encode(message: User, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.name !== '') {
      writer.uint32(10).string(message.name);
    }

    if (message.age !== 0) {
      writer.uint32(16).int32(message.age);
    }

    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): User {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    const end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUser();

    while (reader.pos < end) {
      const tag = reader.uint32();

      switch (tag >>> 3) {
        case 1:
          message.name = reader.string();
          break;

        case 2:
          message.age = reader.int32();
          break;

        default:
          reader.skipType(tag & 7);
          break;
      }
    }

    return message;
  },

  fromPartial(object: DeepPartial<User>): User {
    const message = createBaseUser();
    message.name = object.name ?? '';
    message.age = object.age ?? 0;
    return message;
  },
};
