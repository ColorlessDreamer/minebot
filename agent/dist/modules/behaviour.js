export var BehaviourMode;
(function (BehaviourMode) {
    BehaviourMode["IDLE"] = "IDLE";
    BehaviourMode["WANDERING"] = "WANDERING";
    BehaviourMode["FOLLOWING"] = "FOLLOWING";
    BehaviourMode["INTERACTING"] = "INTERACTING";
    BehaviourMode["ATTACKING"] = "ATTACKING";
})(BehaviourMode || (BehaviourMode = {}));
export const WANDER_RADIUS = 10;
export const WANDER_INTERVAL = 5000;
export const LOOK_INTERVAL = 2000;
export const IDLE_TIMEOUT = 30000;
export const ATTACK_RANGE = 4;
export const THREAT_TIMEOUT = 3000;
export const DETECTION_RANGE = 16;
