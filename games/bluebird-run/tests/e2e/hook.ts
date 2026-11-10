import type { Action, GameState } from '../../src/game/state';

declare global {
  interface Window {
    __bluebird: { getState(): GameState; dispatch(a: Action): void };
  }
}

export {};
