import { Bot, BotEvents } from 'mineflayer'
import { Entity } from 'prismarine-entity'
import { state } from './state.js'
import { debugLog } from './debug.js'
import { trackPotentialAttacker } from './perception.js'
import { identifyMostLikelyAttacker } from './perception.js'
import { ATTACK_RANGE, DETECTION_RANGE } from './behaviour.js'
import { DamageInfo } from './state.js'

let lastMovementLog = 0
const MOVEMENT_LOG_INTERVAL = 1000

export function setupDebugging(bot: Bot): void {
  bot.on('goal_reached', () => debugLog('goal_reached', "Reached goal"))
  bot.on('path_update', (r: { status: string }) => debugLog('path_update', "Path update: " + r.status))
  bot.on('end', () => debugLog('end', "Bot disconnected"))
  bot.on('error', (err: Error) => debugLog('error', "Bot error:", err))
}

export function initializeBotListeners(bot: Bot): void {
  bot.on("chat", (username: string, message: string) => {
    if (username === bot.username) return
    debugLog('chat', `[CHAT] ${username}: ${message}`)
    state.last_message = { 
      username, 
      message, 
      timestamp: Date.now() 
    }
  })
  
  bot.on('entityHurt', (entity: Entity) => {
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
      const damage: DamageInfo = {
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
  
  bot.on('entitySwingArm', (entity: Entity) => {
    if (entity !== bot.entity) {
      const distance = bot.entity.position.distanceTo(entity.position)
      if (distance < ATTACK_RANGE) {
        trackPotentialAttacker(entity)
      }
    }
  })
  
  bot.on('entityMoved', (entity: Entity) => {
    const currentTime = Date.now()
    const distance = bot.entity.position.distanceTo(entity.position)
    if (distance <= DETECTION_RANGE && currentTime - lastMovementLog > MOVEMENT_LOG_INTERVAL) {
      debugLog('entityMoved', `Entity: ${entity.username || entity.name || entity.type} moved`)
      lastMovementLog = currentTime
    }
  })


}