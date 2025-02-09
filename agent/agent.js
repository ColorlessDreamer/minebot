import { createBot } from "mineflayer";
import pathfinder from "mineflayer-pathfinder";
import express from "express";


const DEBUG_EVENTS = [
  'chat',
  'entityHurt',
  'entitySwingArm',
  'entityMoved',
  //'entityAttributes',
  //'entityEquip'
];

function debugLog(eventName, message, data) {
  if (DEBUG_EVENTS.includes(eventName)) {
    console.log(`\n--- ${eventName} Event ---`);
    console.log(message);
    if (data) console.log(data);
    console.log('Timestamp:', new Date().toISOString());
  }
}

// Shared constants and state
const ATTACK_RANGE = 4; // blocks
const THREAT_TIMEOUT = 5000; // ms
const DETECTION_RANGE = 16; // only log movements inside this distance
const MOVEMENT_LOG_INTERVAL = 1000; // one log per second
let lastMovementLog = 0;

const state = {
  last_message: null,
  last_damage: null,
  potential_attackers: new Map()
};

const app = express();
app.use(express.json());

// Get command line arguments
const args = process.argv.slice(2);
const isOnline = args.includes('--online');
const serverPort = parseInt(args.find(arg => arg.startsWith('--port='))?.split('=')[1] || '25565', 10);

// Base config for offline/LAN testing
const botConfig = {
  host: 'localhost',
  port: serverPort,
  username: 'Dainsleif',
  version: '1.21.4'
};

if (isOnline) {
  botConfig.host = 'birthday-9VFN.aternos.me';
  botConfig.username = 'Dainsleif';
  botConfig.auth = 'microsoft';
  botConfig.flow = 'msal';
  botConfig.clientId = "00000000402b5328";  // Official Minecraft client ID
  botConfig.onMsaCode = function (data) {
    console.log('To sign in, use a web browser to open the page https://www.microsoft.com/link and enter the code:', data.user_code);
  }
  // Disable token storage
  botConfig.tokenStorage = null;
}

const bot = createBot(botConfig);

bot.loadPlugin(pathfinder.pathfinder);

// Track potential attackers by their recent aggressive actions
function trackPotentialAttacker(entity) {
  state.potential_attackers.set(entity.id, {
    entity: entity,
    lastAggressive: Date.now()
  });
  
  debugLog('entitySwingArm', `Tracking attacker: ${entity.username || entity.name || entity.type} (ID: ${entity.id})`, 
    `Currently tracked: ${Array.from(state.potential_attackers.keys()).join(', ')}`);
  
  setTimeout(() => {
    state.potential_attackers.delete(entity.id);
    debugLog('entitySwingArm', `Removed from tracking: ${entity.username || entity.name || entity.type} (ID: ${entity.id})`);
  }, THREAT_TIMEOUT);
}

function identifyMostLikelyAttacker() {
  let mostRecent = null;
  let mostRecentTime = 0;

  debugLog('entityHurt', 'Searching for attacker among tracked entities:');
  for (const [id, data] of state.potential_attackers) {
    debugLog('entityHurt', `Entity ${id} last aggressive at ${new Date(data.lastAggressive).toISOString()}`);
    if (data.lastAggressive > mostRecentTime) {
      mostRecent = data.entity;
      mostRecentTime = data.lastAggressive;
    }
  }

  debugLog('entityHurt', `Most likely attacker identified: ${mostRecent ? (mostRecent.username || mostRecent.type) : 'none'}`);
  return mostRecent;
}

// Event Listener Setup
function setupDebugging() {
  bot.on('goal_reached', () => debugLog('goal_reached', "Reached goal"));
  bot.on('path_update', (r) => debugLog('path_update', "Path update: " + r.status));
  bot.on('end', () => debugLog('end', "Bot disconnected"));
  bot.on('error', (err) => debugLog('error', "Bot error:", err));
  
  bot.on('entityAttributes', (entity) => {
    // Filter out ambient/water creatures if not combat-relevant:
    const relevantTypes = ['player', 'monster', 'hostile'];
    if (relevantTypes.includes(entity.type)) {
      debugLog('entityAttributes', "Entity attributes changed", {
        id: entity.id,
        type: entity.type,
        attributes: entity.attributes
      });
    }
  });
  
  bot.on('entityEquip', (entity) => {
    debugLog('entityEquip', "Entity changed equipment", {
      id: entity.id,
      type: entity.type,
      equipment: entity.equipment
    });
  });
}

function initializeBotListeners() {
  bot.on("chat", (username, message) => {
    if (username === bot.username) return;
    debugLog('chat', `[CHAT] ${username}: ${message}`);
    state.last_message = { username, message };
  });

  bot.on('entityHurt', (entity) => {
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
      state.last_damage = {
        attacker: attacker ? {
          type: attacker.name,
          entityId: attacker.id,
          username: attacker.username || null,
          confidence: 'heuristic'
        } : null,
        health: bot.health,
        timestamp: Date.now()
      };
      debugLog('entityHurt', "Updated damage state", state.last_damage);
    }
  });
  
  bot.on('entitySwingArm', (entity) => {
    if (entity !== bot.entity) {
      const distance = bot.entity.position.distanceTo(entity.position);
      const heldItem = entity.heldItem; 
      debugLog('entitySwingArm', `Entity: ${entity.username || entity.name || entity.type} (ID: ${entity.id}) swinging arm`,
        `Distance to bot: ${distance.toFixed(2)}; Held item: ${heldItem ? heldItem.name : 'empty hand'}`);
      
      if (distance < ATTACK_RANGE) {
        trackPotentialAttacker(entity);
      }
    }
  });
  
  bot.on('entityMoved', (entity) => {
    const currentTime = Date.now();
    const distance = bot.entity.position.distanceTo(entity.position);
    if (distance <= DETECTION_RANGE && currentTime - lastMovementLog > MOVEMENT_LOG_INTERVAL) {
      debugLog('entityMoved', `Entity: ${entity.username || entity.name || entity.type} (ID: ${entity.id}) moved`,
        `Position: (${entity.position.x.toFixed(2)}, ${entity.position.y.toFixed(2)}, ${entity.position.z.toFixed(2)}); Distance to bot: ${distance.toFixed(2)} blocks`);
      lastMovementLog = currentTime;
    }
  });
}

app.get("/sense", (req, res) => {
  const fullState = {
    ...state,
    is_raining: bot.isRaining,
    is_day: bot.time.isDay,
    entities: getNearbyEntities(bot, DETECTION_RANGE),
    bot_position: bot.entity.position
  };
  res.json(fullState);
});

app.post("/act", (req, res) => {
  const { action } = req.body;
  console.log("Performing action:", action);
  let entityID;
  let entity;
  
  switch(action) {
    case "chat":
      bot.chat(req.body.message);
      break;
      
    case "move":
      entityID = req.body.entityID;
      const follow = req.body.follow || false;
      entity = bot.entities[entityID];
      if (!entity) {
        console.error("Entity not found with ID", entityID);
        break;
      }
      
      if (follow) {
        const goal = new pathfinder.goals.GoalFollow(entity, 2, 1);
        bot.pathfinder.setGoal(goal, true);
      } else {
        const goal = new pathfinder.goals.GoalNear(entity.position.x, entity.position.y, entity.position.z, 2);
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
          const goal = new pathfinder.goals.GoalXZ(x, z);
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

function getNearbyEntities(bot, distance = 16) {
  const allEntities = Object.keys(bot.entities).map((id) => {
    const entity = bot.entities[id];
    return {
      entityID: id,
      type: entity.name,
      position: entity.position,
      username: entity.username || null
    };
  });
  
  const otherEntities = allEntities.filter((entity) => {
    return entity.entityID !== bot.entity.id.toString();
  });
  
  const nearbyEntities = otherEntities.filter((entity) => {
    return bot.entity.position.distanceTo(entity.position) < distance;
  });
  
  nearbyEntities.forEach((entity) => {
    delete entity.position;
  });
  
  return nearbyEntities;
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
