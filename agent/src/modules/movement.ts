import { Bot } from 'mineflayer'
import pkg from 'mineflayer-pathfinder'
import { Vec3 } from 'vec3'
import { WANDER_RADIUS, WANDER_INTERVAL } from './behaviour.js'

const { goals } = pkg

export function startWandering(bot: Bot, origin: Vec3): NodeJS.Timeout {
  return setInterval(() => {
    const angle = Math.random() * Math.PI * 2
    const radius = Math.random() * WANDER_RADIUS
    const x = origin.x + Math.cos(angle) * radius
    const z = origin.z + Math.sin(angle) * radius
    bot.pathfinder.setGoal(new goals.GoalNearXZ(x, z, 2))
    bot.look(Math.random() * Math.PI * 2, Math.random() * 0.5 - 0.25)
  }, WANDER_INTERVAL)
}

export function stopWandering(bot: Bot, interval: NodeJS.Timeout | null): void {
  if (interval) {
    clearInterval(interval)
    bot.pathfinder.setGoal(null)
  }
}