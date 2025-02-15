import { state } from './state.js';
import { BehaviourMode } from './behaviour.js';
let attackCount = 0;
let handleAttack;
export function startCombat(bot, target) {
    state.currentBehavior = BehaviourMode.ATTACKING;
    attackCount = 0;
    handleAttack = () => {
        attackCount++;
        if (attackCount >= 5) {
            stopCombat(bot);
        }
    };
    bot.on('attackedTarget', handleAttack);
    bot.pvp.attack(target);
}
function stopCombat(bot) {
    bot.removeListener('attackedTarget', handleAttack);
    bot.pvp.stop();
    state.currentBehavior = BehaviourMode.IDLE;
    attackCount = 0;
}
