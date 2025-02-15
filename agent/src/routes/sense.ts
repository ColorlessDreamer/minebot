import { Bot } from 'mineflayer'
import { Entity } from 'prismarine-entity'
import { Request, Response } from 'express'
import { Vec3 } from 'vec3'
import { state } from '../modules/state.js'
import { DETECTION_RANGE } from '../modules/behaviour.js'
import { getNearbyEntities } from '../modules/perception.js'


export function handleSense(bot: Bot, req: Request, res: Response) {
  const { wanderInterval, ...stateWithoutInterval } = state
  const fullState = {
    ...stateWithoutInterval,
    is_raining: bot.isRaining,
    is_day: bot.time.isDay,
    entities: getNearbyEntities(bot, DETECTION_RANGE),
    bot_position: bot.entity.position,
    current_behavior: state.currentBehavior
  }
  res.json(fullState)
}