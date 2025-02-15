export enum BehaviourMode {
  IDLE = "IDLE",
  WANDERING = "WANDERING",
  FOLLOWING = "FOLLOWING",
  INTERACTING = "INTERACTING",
  ATTACKING = "ATTACKING"
}

export const WANDER_RADIUS = 10
export const WANDER_INTERVAL = 5000
export const LOOK_INTERVAL = 2000
export const IDLE_TIMEOUT = 30000
export const ATTACK_RANGE = 4
export const THREAT_TIMEOUT = 3000
export const DETECTION_RANGE = 16