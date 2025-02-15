import pkg from 'mineflayer-pathfinder';
import { state } from '../modules/state.js';
import { BehaviourMode } from '../modules/behaviour.js';
import { startCombat } from '../modules/attack.js';
import { startWandering } from '../modules/movement.js';
const { goals } = pkg;
export function handleAct(bot, req, res) {
    const { action } = req.body;
    console.log("Performing action:", action);
    let entityID;
    let entity;
    switch (action) {
        case "chat":
            bot.chat(req.body.message);
            break;
        case "attack":
            entityID = req.body.entityID;
            entity = bot.entities[entityID];
            if (!entity) {
                console.error("Entity not found with ID", entityID);
                break;
            }
            startCombat(bot, entity);
            break;
        case "move":
            state.currentBehavior = BehaviourMode.FOLLOWING;
            entityID = req.body.entityID;
            const follow = req.body.follow || false;
            entity = bot.entities[entityID];
            if (!entity) {
                console.error("Entity not found with ID", entityID);
                break;
            }
            if (follow) {
                bot.pathfinder.setGoal(new goals.GoalFollow(entity, 2), true);
            }
            else {
                bot.pathfinder.setGoal(new goals.GoalNear(entity.position.x, entity.position.y, entity.position.z, 2));
                setTimeout(() => {
                    bot.pathfinder.setGoal(null);
                    state.currentBehavior = BehaviourMode.WANDERING;
                }, 5000);
            }
            break;
        case "wander":
            state.currentBehavior = req.body.enabled ? BehaviourMode.WANDERING : BehaviourMode.IDLE;
            if (req.body.enabled) {
                state.wanderInterval = startWandering(bot, bot.entity.position.clone());
            }
            break;
        case "dance":
            state.currentBehavior = BehaviourMode.INTERACTING;
            const style = req.body.style || "spin";
            if (style === "spin") {
                const startPos = bot.entity.position.clone();
                const radius = 2;
                const points = 8;
                let currentPoint = 0;
                const danceInterval = setInterval(() => {
                    const angle = (currentPoint / points) * Math.PI * 2;
                    const x = startPos.x + Math.cos(angle) * radius;
                    const z = startPos.z + Math.sin(angle) * radius;
                    bot.pathfinder.setGoal(new goals.GoalXZ(x, z));
                    currentPoint = (currentPoint + 1) % points;
                }, 1000);
                setTimeout(() => {
                    clearInterval(danceInterval);
                    bot.pathfinder.setGoal(null);
                    state.currentBehavior = BehaviourMode.WANDERING;
                }, 8000);
            }
            break;
        case 'null':
            if (!bot.pathfinder) {
                console.error("Pathfinder not initialized");
                break;
            }
            bot.pathfinder.setGoal(null);
            break;
        default:
            console.error("Unknown action", action);
    }
    res.send("Action performed");
}
