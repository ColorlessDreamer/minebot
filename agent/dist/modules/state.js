import { BehaviourMode } from './behaviour.js';
export const state = {
    last_message: null,
    last_damage: null,
    potential_attackers: new Map(),
    currentBehavior: BehaviourMode.IDLE,
    wanderInterval: null,
    attackInterval: null
};
