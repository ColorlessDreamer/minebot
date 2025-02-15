import { Entity } from 'prismarine-entity'
import { BehaviourMode } from './behaviour.js'

export interface Message {
  username: string
  message: string
  timestamp: number
}

export interface DamageInfo {
  attacker: {
    type: string
    entityId: number
    username: string | null
    confidence: 'heuristic'
  } | null
  health: number
  timestamp: number
}

export interface BotState {
  last_message: Message | null
  last_damage: DamageInfo | null
  potential_attackers: Map<number, {
    entity: Entity
    lastAggressive: number
  }>
  currentBehavior: BehaviourMode
  wanderInterval?: NodeJS.Timeout | null
  attackInterval?: NodeJS.Timeout | null
}

export const state: BotState = {
  last_message: null,
  last_damage: null,
  potential_attackers: new Map(),
  currentBehavior: BehaviourMode.IDLE,
  wanderInterval: null,
  attackInterval: null
}