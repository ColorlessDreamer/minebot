import { createBot } from "mineflayer";
import pathfinder from "mineflayer-pathfinder";
import express from "express";

const state = {
  last_message: null
};

const app = express();
app.use(express.json());

// At the top of the file with other constants
const RECOGNIZABLE_BLOCKS = {
  // Trees
  'tree': ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log'],
  // Ores
  'ore': ['iron_ore', 'gold_ore', 'diamond_ore', 'coal_ore'],
  // Add more categories as needed
};


const args = process.argv.slice(2);
const isOnline = args.includes('--online');
const serverPort = parseInt(args.find(arg => arg.startsWith('--port='))?.split('=')[1] || '25565', 10);

// Base config for offline/LAN testing
const botConfig = {
  host: 'localhost',
  port: serverPort,
  username: 'TestBot',
  version: '1.21.4'
};


const bot = createBot(botConfig);


bot.loadPlugin(pathfinder.pathfinder);

// Enhanced logging setup
function setupDebugging() {
  bot.on('goal_reached', () => console.log("Reached goal"));
  bot.on('path_update', (r) => console.log("Path update:", r.status));
  bot.on('end', () => console.log("Bot disconnected"));
  bot.on('error', (err) => console.error("Bot error:", err));
}

function initializeBotListeners() {
  bot.on("chat", (username, message) => {
    if (username === bot.username) return;
    
    console.log(`[CHAT] ${username}: ${message}`);
    state.last_message = { username, message };
  });
}

function getNearbyEntities(bot, distance = 16) {
  const allEntities = Object.keys(bot.entities).map((id) => {
    const entity = bot.entities[id];
    return {
      entityID: id,
      type: entity.name,
      position: entity.position,
      username: entity.username || null
    }
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

function getNearbyBlocks(bot, blockTypes, distance = 16) {
  const blocks = [];
  const pos = bot.entity.position;
  
  // Search in a cube around the bot
  for (let x = -distance; x <= distance; x++) {
    for (let y = -distance; y <= distance; y++) {
      for (let z = -distance; z <= distance; z++) {
        const block = bot.blockAt(pos.offset(x, y, z));
        if (block && blockTypes.includes(block.name)) {
          blocks.push({
            type: block.name,
            position: block.position,
            distance: pos.distanceTo(block.position)
          });
        }
      }
    }
  }
  
  return blocks.sort((a, b) => a.distance - b.distance);
}

app.get("/sense", (req, res) => {
  // Get both trees AND ores
  const nearbyBlocks = [
    ...getNearbyBlocks(bot, RECOGNIZABLE_BLOCKS['tree'], 16),
    ...getNearbyBlocks(bot, RECOGNIZABLE_BLOCKS['ore'], 16)
  ];
  
  // Keep only the single closest block of each type
  const uniqueBlocks = nearbyBlocks.reduce((unique, block) => {
    // Use just the block type as key to keep only closest of each type
    if (!unique[block.type] || block.distance < unique[block.type].distance) {
      unique[block.type] = {
        type: block.type,
        position: {
          x: Math.floor(block.position.x),
          y: Math.floor(block.position.y),
          z: Math.floor(block.position.z)
        },
        distance: Math.floor(block.distance)
      };
    }
    return unique;
  }, {});

  const sortedBlocks = Object.values(uniqueBlocks)
    .sort((a, b) => a.distance - b.distance);

  const fullState = {
    is_raining: bot.isRaining,
    is_day: bot.time.isDay,
    entities: getNearbyEntities(bot, 16),
    bot_position: {
      x: Math.floor(bot.entity.position.x),
      y: Math.floor(bot.entity.position.y),
      z: Math.floor(bot.entity.position.z)
    },
    ...(sortedBlocks.length > 0 && { blocks: sortedBlocks })
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
        const blockType = req.body.blockType;
        const follow = req.body.follow || false;
      
        if (entityID) {
          entity = bot.entities[entityID];
          if (!entity) {
            console.error("Entity not found with ID", entityID);
            break;
          }
          
          if (follow) {
            // For continuous following, set goal without timeout
            const goal = new pathfinder.goals.GoalFollow(entity, 2, 1);
            bot.pathfinder.setGoal(goal, true);
          } else {
            // For one-time movement, set goal with timeout
            const goal = new pathfinder.goals.GoalNear(entity.position.x, entity.position.y, entity.position.z, 2);
            bot.pathfinder.setGoal(goal);
            setTimeout(() => bot.pathfinder.setGoal(null), 5000);
          }
        } else if (blockType) {
          // Get all block types in the category if it exists
          const blockTypes = RECOGNIZABLE_BLOCKS[blockType] || [blockType];
          const blocks = getNearbyBlocks(bot, blockTypes, 16);
          if (blocks.length > 0) {
            const target = blocks[0]; // Get closest matching block
            const goal = new pathfinder.goals.GoalNear(
              target.position.x,
              target.position.y,
              target.position.z,
              2
            );
            bot.pathfinder.setGoal(goal);
            setTimeout(() => bot.pathfinder.setGoal(null), 5000);
          } else {
            console.log(`No ${blockType} blocks found nearby`);
          }
        }
        break;
      
    case "dance":
        const style = req.body.style || "spin";
        if (style === "spin") {
            // Get current position
            const startPos = bot.entity.position.clone();
            // Create points in a circle around start position
            const radius = 2;
            const points = 8;
            let currentPoint = 0;
            
            const danceInterval = setInterval(() => {
                // Calculate next point in circle
                const angle = (currentPoint / points) * Math.PI * 2;
                const x = startPos.x + Math.cos(angle) * radius;
                const z = startPos.z + Math.sin(angle) * radius;
                
                // Move to next point
                const goal = new pathfinder.goals.GoalXZ(x, z);
                bot.pathfinder.setGoal(goal);
                
                currentPoint = (currentPoint + 1) % points;
            }, 1000); // Move to new point every second
            
            // Stop dancing after 8 seconds (full circle)
            setTimeout(() => {
                clearInterval(danceInterval);
                bot.pathfinder.setGoal(null);
            }, 8000);
        }
        break;
    
      
    case 'null':
      // START OF NEW CODE
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
      // END OF NEW CODE
      break;
      
    default:
      console.error("Unknown action", action);
  }
  
  res.send("Action performed");
});


function startServer() {
  const port = 3000;
  app.listen(port, () => {
    console.log(`Agent server listening at http://localhost:${port}`);
  });

  setupDebugging();
  initializeBotListeners();
}

startServer();
