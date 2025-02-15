import { state } from './state.js';
import { debugLog } from './debug.js';
import { trackPotentialAttacker } from './perception.js';
import { identifyMostLikelyAttacker } from './perception.js';
import { ATTACK_RANGE, DETECTION_RANGE } from './behaviour.js';
let lastMovementLog = 0;
const MOVEMENT_LOG_INTERVAL = 1000;
export function setupDebugging(bot) {
    bot.on('goal_reached', () => debugLog('goal_reached', "Reached goal"));
    bot.on('path_update', (r) => debugLog('path_update', "Path update: " + r.status));
    bot.on('end', () => debugLog('end', "Bot disconnected"));
    bot.on('error', (err) => debugLog('error', "Bot error:", err));
}
export function initializeBotListeners(bot) {
    bot.on("chat", (username, message) => {
        if (username === bot.username)
            return;
        debugLog('chat', `[CHAT] ${username}: ${message}`);
        state.last_message = {
            username,
            message,
            timestamp: Date.now()
        };
    });
    bot.on('entityHurt', (entity) => {
        debugLog('entityHurt', "Entity hurt detected", {
            entity: {
                id: entity.id,
                type: entity.type,
                name: entity.name,
                username: entity.username
            },
            botHealth: bot.health
        });
        if (entity === bot.entity) {
            debugLog('entityHurt', "Confirmed: Bot was hurt");
            const attacker = identifyMostLikelyAttacker();
            const damage = {
                attacker: attacker ? {
                    type: attacker.name ?? 'unknown',
                    entityId: attacker.id, // Now a number, matching our interface
                    username: attacker.username || null,
                    confidence: 'heuristic'
                } : null,
                health: bot.health,
                timestamp: Date.now()
            };
            state.last_damage = damage;
            debugLog('entityHurt', "Updated damage state", state.last_damage);
        }
    });
    bot.on('entitySwingArm', (entity) => {
        if (entity !== bot.entity) {
            const distance = bot.entity.position.distanceTo(entity.position);
            if (distance < ATTACK_RANGE) {
                trackPotentialAttacker(entity);
            }
        }
    });
    bot.on('entityMoved', (entity) => {
        const currentTime = Date.now();
        const distance = bot.entity.position.distanceTo(entity.position);
        if (distance <= DETECTION_RANGE && currentTime - lastMovementLog > MOVEMENT_LOG_INTERVAL) {
            debugLog('entityMoved', `Entity: ${entity.username || entity.name || entity.type} moved`);
            lastMovementLog = currentTime;
        }
    });
}
