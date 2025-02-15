import { Bot, BotEvents } from 'mineflayer'
import { Entity } from 'prismarine-entity'
import { state } from './state.js'
import { BehaviourMode } from './behaviour.js'

declare module  'mineflayer' {
  interface BotEvents {
    attackedTarget: () => void
    startedAttacking: () => void
    stoppedAttacking: () => void
  }
}

let attackCount = 0
let handleAttack: () => void

export function startCombat(bot: Bot, target: Entity) {
  state.currentBehavior = BehaviourMode.ATTACKING
  attackCount = 0

  handleAttack = () => {
    attackCount++
    if (attackCount >= 5) {
      stopCombat(bot)
    }
  }

  bot.on('attackedTarget', handleAttack)
  bot.pvp.attack(target)
}

function stopCombat(bot: Bot) {
  bot.removeListener('attackedTarget', handleAttack)
  bot.pvp.stop()
  state.currentBehavior = BehaviourMode.IDLE
  attackCount = 0
}
