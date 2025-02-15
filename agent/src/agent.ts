import { Bot, createBot } from 'mineflayer'
import { pathfinder } from 'mineflayer-pathfinder'
import express from 'express'
import { createBotConfig } from './config/botConfig.js'
import { state } from './modules/state.js'
import { BehaviourMode } from './modules/behaviour.js'
import { startWandering } from './modules/movement.js'
import { handleSense } from './routes/sense.js'
import { handleAct } from './routes/act.js'
import { setupDebugging, initializeBotListeners } from './modules/listeners.js'
import { plugin as collectBlock } from 'mineflayer-collectblock'
import { plugin as pvp } from 'mineflayer-pvp'

const args = process.argv.slice(2)
const isOnline = args.includes('--online')
const serverPort = parseInt(args.find(arg => arg.startsWith('--port='))?.split('=')[1] || '25565', 10)

const botConfig = createBotConfig(isOnline, serverPort)
const app = express()
app.use(express.json())
const bot: Bot = createBot(botConfig)

console.log('Attempting to connect with config:', {
  host: botConfig.host,
  port: botConfig.port,
  username: botConfig.username,
  version: botConfig.version
})

bot.on('login', () => {
  console.log('Bot successfully logged in!')
})

bot.on('error', (err) => {
  console.log('Bot connection error:', err)
})

bot.loadPlugin(pathfinder)
bot.loadPlugin(pvp)
bot.loadPlugin(collectBlock)

function startServer() {
  const port = 3000
  app.listen(port, () => {
    console.log(`Agent server listening at http://localhost:${port}`)
  })

  app.get("/sense", (req, res) => handleSense(bot, req, res))
  app.post("/act", (req, res) => handleAct(bot, req, res))

  setupDebugging(bot)
  initializeBotListeners(bot)

  bot.once('spawn', () => {
    console.log("Bot spawned")
    state.currentBehavior = BehaviourMode.WANDERING
    state.wanderInterval = startWandering(bot, bot.entity.position.clone())
  })
}

startServer()
