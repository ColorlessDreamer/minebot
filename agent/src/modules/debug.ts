import { BotEvents } from 'mineflayer'

const DEBUG_EVENTS: Array<keyof BotEvents> = [
  'chat',
  'entityHurt',
  'entitySwingArm',
  'entityMoved'
]

export function debugLog(eventName: keyof BotEvents, message: string, data?: any): void {
  if (DEBUG_EVENTS.includes(eventName)) {
    console.log(`\n--- ${eventName} Event ---`)
    console.log(message)
    if (data) console.log(data)
    console.log('Timestamp:', new Date().toISOString())
  }
}