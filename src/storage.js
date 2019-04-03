/* @flow */

import type { State, StatePath } from "./state";
import type { InflightMessage
            , Message
            , Subscription } from "./message";
import type { StateInstance
            , StateInstanceMap } from "./instance";
import type { Supervisor } from "./supervisor";

import { EventEmitter } from "./events";
import { subscriptionIsPassive
       , subscriptionMatches } from "./message";

export type Sink = (message: Message, path: StatePath) => mixed;
export type Subscribers = Array<{ listener: Sink, filter: Array<Subscription> }>;

type StateDefs = { [key:string]: State<any, any> };

export type StorageEvents = {
  /**
   * Emitted when a message did not find any active subscriber.
   *
   * Parameters:
   *
   *  * Message
   *  * Path to the origin state
   */
  unhandledMessage: [Message, StatePath],
  /**
   * Emitted when a state-instance is created.
   *
   * Parameters:
   *
   *  * Path to the new state
   *  * Initial data supplied to the state
   *  * State data
   */
  stateCreated: [StatePath, mixed, mixed, StateInstance<any, any>],
  /**
   * Emitted when a state-instance updates its data.
   *
   * Parameters:
   *
   *  * The new data
   *  * Path to the new state
   *  * Message which caused the update
   */
  stateNewData: [mixed, StatePath, Message, StateInstance<any, any>],
  /**
   * Emitted when a message is queued for processing.
   *
   * Parameters:
   *
   *  * The message
   *  * Path of the origin, the closest state
   */
  messageQueued: [Message, StatePath, StateInstance<any, any>];
  /**
   * Emitted when a message is queued for processing.
   *
   * Parameters:
   *
   *  * The message
   *  * Path of the matching state-instance
   *  * If the subscription was passive
   */
  messageMatched: [Message, StatePath, boolean, StateInstance<any, any>];
};

/**
 * Base node in a state-tree, anchors all states and carries all data.
 */
export class Storage extends EventEmitter<StorageEvents> {
  subscribers: Subscribers = [];
  nested: StateInstanceMap = {};
  /**
   * State-definitions, used for subscribers and messages.
   */
  defs: StateDefs   = {};

  constructor() {
    // TODO: Restore state
    super();
  }

  getStorage(): Storage {
    return this;
  }

  getPath(): StatePath {
    return [];
  }

  /**
   * Test
   */
  registerState<T, I>(state: State<T, I>) {
    if( ! this.ensureState(state)) {
      // FIXME: Proper exception type
      throw new Error(`Duplicate state name ${state.name}`);
    }
  };

  /**
   * Loads the given state-definition for use, ensures that it is not a new
   * state with the same name if it is already loaded. `true` returned if it
   * was new, `false` otherwise.
   */
  ensureState<T, I>(state: State<T, I>): boolean {
    const { name } = state;

    if( ! this.defs[name]) {
      this.defs[name] = state;

      return true;
    }

    if(this.defs[name] !== state) {
      // FIXME: Proper exception type
      throw new Error(`State object mismatch for state ${name}`);
    }

    return false;
  };

  stateDefinition<T, I>(instanceName: string): ?State<T, I> {
    return this.defs[instanceName];
  };

  getNested<T, I>(state: State<T, I>): ?StateInstance<T, I> {
    const { nested } = this;

    if(process.env.NODE_ENV !== "production") {
      this.ensureState(state);
    }

    return nested[state.name];
  };

  sendMessage(message: Message): void {
    processMessage(this, {
      message,
      source: [],
      received: null,
    });
  };

  addSubscriber(listener: Sink, filter: Array<Subscription>) {
    this.subscribers.push({ listener, filter });
  };

  removeSubscriber(listener: Sink) {
    const { subscribers } = this;

    for(let i = 0; i < subscribers.length; i++) {
      if(subscribers[i].listener === listener) {
        subscribers.splice(i, 1);

        return;
      }
    }
  };
}

export function processMessages(storage: Storage, messages: Array<InflightMessage>) {
  for(let i = 0; i < messages.length; i++) {
    processMessage(storage, messages[i]);
  }
}

function processMessage(storage: Storage, inflight: InflightMessage) {
  const { subscribers }     = storage;
  const { message, source } = inflight;
  let   received            = Boolean(inflight.received);

  for(let i = 0; i < subscribers.length; i++) {
    const { listener, filter } = subscribers[i];

    // TODO: Split
    for(let j = 0; j < filter.length; j++) {
      if(subscriptionMatches(filter[j], message, Boolean(received))) {
        if( ! subscriptionIsPassive(filter[j])) {
          received = true;
        }

        listener(message, source);
      }
    }
  }

  if( ! received) {
    storage.emit("unhandledMessage", message, source);
  }
}