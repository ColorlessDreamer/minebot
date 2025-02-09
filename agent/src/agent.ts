import { Bot, BotOptions, BotEvents, createBot } from 'mineflayer'
import { Entity } from 'prismarine-entity'
import pkg from 'mineflayer-pathfinder'
import express, { Request, Response } from 'express'
import { Vec3 } from 'vec3'

const { pathfinder, goals } = pkg

// Core interfaces
interface Message {
  username: string
  message: string
  timestamp: number
}

interface DamageInfo {
  attacker: {
    type: string
    entityId: number
    username: string | null
    confidence: 'heuristic'
  } | null
  health: number
  timestamp: number
}

interface BotState {
  last_message: Message | null
  last_damage: DamageInfo | null
  potential_attackers: Map<number, {
    entity: Entity
    lastAggressive: number
  }>
}

const state: BotState = {
  last_message: null,   // initial value is null
  last_damage: null,    // initial value is null
  potential_attackers: new Map()
};


const DEBUG_EVENTS: Array<keyof BotEvents> = [
  'chat',
  'entityHurt',
  'entitySwingArm',
  'entityMoved',
  'entityAttributes',
  'entityEquip'
]

// Bot configuration
interface ExtendedBotOptions extends BotOptions {
  flow?: string
  tokenStorage?: null
  onMsaCode?: (data: { user_code: string }) => void
  clientId?: string
}
const args = process.argv.slice(2)
const isOnline = args.includes('--online')
const serverPort = parseInt(args.find(arg => arg.startsWith('--port='))?.split('=')[1] || '25565', 10)

const botConfig: ExtendedBotOptions = {
  host: 'localhost',
  port: serverPort,
  username: 'Dainsleif',
  version: '1.21.4'
}

if (isOnline) {
  botConfig.host = 'birthday-9VFN.aternos.me'
  botConfig.username = 'Dainsleif'
  botConfig.auth = 'microsoft'
  botConfig.flow = 'msal'
  botConfig.clientId = "00000000402b5328"
  botConfig.onMsaCode = function (data: { user_code: string }) {
    console.log('To sign in, use a web browser to open the page https://www.microsoft.com/link and enter the code:', data.user_code)
  }
  botConfig.tokenStorage = null
}


function debugLog(eventName: keyof BotEvents, message: string, data?: any): void {
  if (DEBUG_EVENTS.includes(eventName)) {
    console.log(`\n--- ${eventName} Event ---`)
    console.log(message)
    if (data) console.log(data)
    console.log('Timestamp:', new Date().toISOString())
  }
}

function trackPotentialAttacker(entity: Entity): void {
  state.potential_attackers.set(entity.id, {
    entity: entity,
    lastAggressive: Date.now()
  })
  
  debugLog('entitySwingArm', `Tracking attacker: ${entity.username || entity.name || entity.type} (ID: ${entity.id})`, 
    `Currently tracked: ${Array.from(state.potential_attackers.keys()).join(', ')}`)
  
  setTimeout(() => {
    state.potential_attackers.delete(entity.id)
    debugLog('entitySwingArm', `Removed from tracking: ${entity.username || entity.name || entity.type} (ID: ${entity.id})`)
  }, THREAT_TIMEOUT)
}

function identifyMostLikelyAttacker(): Entity | null {
  let mostRecent: Entity | null = null
  let mostRecentTime = 0

  debugLog('entityHurt', 'Searching for attacker among tracked entities:')
  for (const [id, data] of state.potential_attackers) {
    debugLog('entityHurt', `Entity ${id} last aggressive at ${new Date(data.lastAggressive).toISOString()}`)
    if (data.lastAggressive > mostRecentTime) {
      mostRecent = data.entity
      mostRecentTime = data.lastAggressive
    }
  }

  debugLog('entityHurt', `Most likely attacker identified: ${mostRecent ? (mostRecent.username || mostRecent.type) : 'none'}`)
  return mostRecent
}


// Shared constants and state
const ATTACK_RANGE = 4
const THREAT_TIMEOUT = 3000
const DETECTION_RANGE = 16
const MOVEMENT_LOG_INTERVAL = 1000
let lastMovementLog = 0

const app = express()
app.use(express.json())
const bot: Bot = createBot(botConfig)

bot.loadPlugin(pathfinder)


function setupDebugging(): void {
  bot.on('goal_reached', () => debugLog('goal_reached', "Reached goal"))
  bot.on('path_update', (r: { status: string }) => debugLog('path_update', "Path update: " + r.status))
  bot.on('end', () => debugLog('end', "Bot disconnected"))
  bot.on('error', (err: Error) => debugLog('error', "Bot error:", err))
  
  bot.on('entityAttributes', (entity: Entity) => {
    const relevantTypes = ['player', 'monster', 'hostile']
    if (relevantTypes.includes(entity.type)) {
      debugLog('entityAttributes', "Entity attributes changed", {
        id: entity.id,
        type: entity.type,
        attributes: (entity as any).attributes
      })
    }
  })
  
  bot.on('entityEquip', (entity: Entity) => {
    debugLog('entityEquip', "Entity changed equipment", {
      id: entity.id,
      type: entity.type,
      equipment: entity.equipment
    })
  })
}

// Initialize bot listeners
function initializeBotListeners(): void {
  bot.on("chat", (username: string, message: string) => {
    if (username === bot.username) return;
    debugLog('chat', `[CHAT] ${username}: ${message}`);
    state.last_message = { 
      username, 
      message, 
      timestamp: Date.now() 
    } as Message;
  });
  
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
  
  // Corrected entitySwingArm event handler
  bot.on('entitySwingArm', (entity: Entity) => {
    if (entity !== bot.entity) {
      const distance = bot.entity.position.distanceTo(entity.position);
      const heldItem = entity.heldItem;
      debugLog(
        'entitySwingArm', 
        `Entity: ${entity.username || entity.name || entity.type} (ID: ${entity.id}) swinging arm`,
        `Distance to bot: ${distance.toFixed(2)}; Held item: ${heldItem ? heldItem.name : 'empty hand'}`
      );
      
      if (distance < ATTACK_RANGE) {
        trackPotentialAttacker(entity);
      }
    }
  });
  
  bot.on('entityMoved', (entity: Entity) => {
    const currentTime = Date.now();
    const distance = bot.entity.position.distanceTo(entity.position);
    if (distance <= DETECTION_RANGE && currentTime - lastMovementLog > MOVEMENT_LOG_INTERVAL) {
      debugLog(
        'entityMoved', 
        `Entity: ${entity.username || entity.name || entity.type} (ID: ${entity.id}) moved`,
        `Position: (${entity.position.x.toFixed(2)}, ${entity.position.y.toFixed(2)}, ${entity.position.z.toFixed(2)}); Distance to bot: ${distance.toFixed(2)} blocks`
      );
      lastMovementLog = currentTime;
    }
  });
}

// Express routes
app.get("/sense", (req: Request, res: Response) => {
  const fullState = {
    ...state,
    is_raining: bot.isRaining,
    is_day: bot.time.isDay,
    entities: getNearbyEntities(bot, DETECTION_RANGE),
    bot_position: bot.entity.position
  };
  res.json(fullState);
});

app.post("/act", (req: Request<{}, {}, { action: string; message?: string; entityID?: string; follow?: boolean; style?: string }>, res: Response) => {
  const { action } = req.body;
  console.log("Performing action:", action);
  let entityID: string;
  let entity: Entity | null;
  switch (action) {
    case "chat":
      bot.chat(req.body.message!);
      break;
      
    case "move":
      entityID = req.body.entityID!;
      const follow = req.body.follow || false;
      entity = bot.entities[entityID];
      if (!entity) {
        console.error("Entity not found with ID", entityID);
        break;
      }
      
      if (follow) {
        const goal = new goals.GoalFollow(entity, 2);
        bot.pathfinder.setGoal(goal, true);
      } else {
        const goal = new goals.GoalNear(entity.position.x, entity.position.y, entity.position.z, 2);
        bot.pathfinder.setGoal(goal);
        setTimeout(() => bot.pathfinder.setGoal(null), 5000);
      }
      break;
    
    case "dance":
      const style = req.body.style || "spin";
      if (style === "spin") {
        const startPos = bot.entity.position.clone();
        const radius = 2;
        const points = 8;
        let currentPoint = 0;
        
        const danceInterval = setInterval(() => {
          const angle = (currentPoint / points) * Math.PI * 2;
          const x = startPos.x + Math.cos(angle) * radius;
          const z = startPos.z + Math.sin(angle) * radius;
          const goal = new goals.GoalXZ(x, z);
          bot.pathfinder.setGoal(goal);
          currentPoint = (currentPoint + 1) % points;
        }, 1000);
        
        setTimeout(() => {
          clearInterval(danceInterval);
          bot.pathfinder.setGoal(null);
        }, 8000);
      }
      break;
      
    case 'null':
      console.log("Processing null action");
      if (!bot.pathfinder) {
        console.error("Pathfinder not initialized");
        break;
      }
      console.log("Current goal:", bot.pathfinder.goal);
      try {
        bot.pathfinder.setGoal(null);
        console.log("Goal cleared successfully");
      } catch (err) {
        console.error("Error clearing goal:", err);
      }
      break;
      
    default:
      console.error("Unknown action", action);
  }
  
  res.send("Action performed");
});

function getNearbyEntities(bot: Bot, distance = 16) {
  const defaultPosition = new Vec3(0, 0, 0)
  const botPosition = bot.entity.position ?? defaultPosition
  
  return Object.keys(bot.entities)
    // Filter out the bot itself
    .filter(id => id !== bot.entity.id.toString())
    // Filter by distance using entity positions
    .filter(id => {
      const entityPosition = bot.entities[id].position ?? defaultPosition
      return botPosition.distanceTo(entityPosition) < distance
    })
    // Map to just the properties needed by the controller
    .map(id => {
      const entity = bot.entities[id]
      return {
        entityID: id,
        type: entity.name,
        username: entity.username || null
      }
    })
}


function startServer() {
  const port = 3000;
  app.listen(port, () => {
    console.log(`Agent server listening at http://localhost:${port}`);
  });
  setupDebugging();
  initializeBotListeners();
}

startServer();