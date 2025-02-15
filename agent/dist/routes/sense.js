import { state } from '../modules/state.js';
import { DETECTION_RANGE } from '../modules/behaviour.js';
import { getNearbyEntities } from '../modules/perception.js';
export function handleSense(bot, req, res) {
    const { wanderInterval, ...stateWithoutInterval } = state;
    const fullState = {
        ...stateWithoutInterval,
        is_raining: bot.isRaining,
        is_day: bot.time.isDay,
        entities: getNearbyEntities(bot, DETECTION_RANGE),
        bot_position: bot.entity.position,
        current_behavior: state.currentBehavior
    };
    res.json(fullState);
}
