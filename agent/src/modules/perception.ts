import { Bot } from 'mineflayer'
import { Vec3 } from 'vec3'
import { state } from './state.js'
import { Entity } from 'prismarine-entity'
import { debugLog } from './debug.js'
import { THREAT_TIMEOUT } from './behaviour.js'

export function getNearbyEntities(bot: Bot, distance = 16) {
  const defaultPosition = new Vec3(0, 0, 0)
  const botPosition = bot.entity.position ?? defaultPosition
  
  return Object.keys(bot.entities)
    .filter(id => id !== bot.entity.id.toString())
    .filter(id => {
      const entityPosition = bot.entities[id].position ?? defaultPosition
      return botPosition.distanceTo(entityPosition) < distance
    })
    .map(id => {
      const entity = bot.entities[id]
      return {
        entityID: id,
        type: entity.name,
        username: entity.username || null
      }
    })
}

export function trackPotentialAttacker(entity: Entity): void {
    state.potential_attackers.set(entity.id, {
      entity: entity,
      lastAggressive: Date.now()
    })
    
    debugLog('entitySwingArm', `Tracking attacker: ${entity.username || entity.name || entity.type} (ID: ${entity.id})`)
    
    setTimeout(() => {
      state.potential_attackers.delete(entity.id)
      debugLog('entitySwingArm', `Removed from tracking: ${entity.username || entity.name || entity.type} (ID: ${entity.id})`)
    }, THREAT_TIMEOUT)
  }
  
  export function identifyMostLikelyAttacker(): Entity | null {
    let mostRecent: Entity | null = null
    let mostRecentTime = 0
  
    for (const [id, data] of state.potential_attackers) {
      if (data.lastAggressive > mostRecentTime) {
        mostRecent = data.entity
        mostRecentTime = data.lastAggressive
      }
    }
  
    return mostRecent
  }