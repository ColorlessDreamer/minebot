import json
import time
import logging
import requests
from typing import Optional, Tuple
from pydantic_ai import Agent
from pydantic_ai. models.openai import OpenAIModel
from openai import OpenAI

from control.settings import settings
from control.base_models import SenseData, Action, ActionType

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

class Controller:
    def __init__(self, personality_prompt: str = "dain_personality.txt", action_prompt: str = "dain_actions.txt") -> None:
        self.base_url = f"{settings.agent_origin}:{settings.agent_port}"
        
        # Load character prompt for chat responses
        with open(settings.prompt_template_dir / personality_prompt, 'r') as f:
            self.character_prompt = f.read()

        # Load action selection prompt
        with open(settings.prompt_template_dir / action_prompt, 'r') as f:
            self.action_prompt = f.read()
                
        chat_model = OpenAIModel(settings.chat_model, api_key=settings.openai_api_key)        
        action_model = OpenAIModel(settings.action_model, api_key=settings.openai_api_key)

        # Create action selection agent with direct response model typing
        self.action_agent = Agent(action_model, result_type=Action)

        # Register the system prompt function
        @self.action_agent.system_prompt
        def action_system_prompt():
            return self.action_prompt
        
        self.chat_agent = Agent(chat_model, result_type=str)
        
        @self.chat_agent.system_prompt
        def chat_system_prompt():
            return self.character_prompt
        

        
    def select_action(self, sense_data: SenseData) -> Optional[Action]:
        try:
            context = self._format_sense_data_for_action(sense_data)
            
            # Log the input context if it contains follow-related commands
            if sense_data.last_message and any(term in sense_data.last_message.message.lower() 
                                            for term in ["follow", "come with"]):
                logger.info(f"FOLLOW COMMAND DETECTED: {sense_data.last_message.message}")
                logger.info(f"INPUT CONTEXT: {context[:200]}...")  # First 200 chars
            
            # Get the raw response before pydantic_ai processing
            raw_response = self.action_agent.run_sync(
                context, 
                model_settings={"max_tokens": 150}
            )
            
            # Log the complete raw response data
            logger.info(f"RAW MODEL RESPONSE: {raw_response}")
            
            # Get the processed action
            action = raw_response.data
            
            # Log the final processed action
            logger.info(f"PROCESSED ACTION: {action.model_dump()}")
            
            return action
                
        except Exception as e:
            logger.error(f"Error selecting action: {e}")
            return None


    
    def generate_chat_response(self, sense_data: SenseData, chosen_action: Action) -> str:
        try:
            # Build a descriptive context based on what data is available
            context_parts = ["# Current situation"]
            
            # Add message context if available 
            if sense_data.last_message:
                context_parts.append(
                    f"A player named {sense_data.last_message.username} said: "
                    f"\"{sense_data.last_message.message}\""
                )
            
            # Add action context
            action_desc = f"# Chosen action\nI'm going to {chosen_action.action}"
            
            # Add target information for actions that have entityID
            if hasattr(chosen_action, 'entityID') and chosen_action.entityID:
                # Try to find the entity name or username
                target_entity = next(
                    (e for e in sense_data.entities if e.entityID == chosen_action.entityID), 
                    None
                )
                if target_entity:
                    entity_name = target_entity.username or target_entity.type
                    action_desc += f" towards {entity_name}"
                    
            context_parts.append(action_desc)
            
            # Combine all context parts
            user_message = "\n\n".join(context_parts) + "\n\nHow would Dainsleif respond to this?"
            
            # Use the chat agent with the already registered system prompt
            result = self.chat_agent.run_sync(
                user_message,
                model_settings={"max_tokens": 150}
            )
            return result.data
            
        except Exception as e:
            logger.error(f"Error generating chat response: {e}")
            return "I'm not sure what to say right now."

    
    def think(self, sense_data: SenseData) -> Optional[Action]:
        """Main thinking function that coordinates action selection and chat response"""
        # First, select an action using the lighter model
        action = self.select_action(sense_data)
        
        if action and action.action == "chat":
            # If the action is to chat, generate the content
            chat_text = self.generate_chat_response(sense_data, action)
            # Update the action with the generated text
            action.message = chat_text
        
        return action
    
    def sense(self) -> Optional[SenseData]:
        """Get the current state of the agent and environment."""
        try:
            response = requests.get(f"{self.base_url}/sense")
            response.raise_for_status()
            data = response.json()
            return SenseData(**data)
        except Exception as e:
            logger.error(f"Failed to sense: {e}")
            return None

    def act(self, action: Action) -> None:
        """Dispatch an action to the agent."""
        try:
            response = requests.post(
                f"{self.base_url}/act", 
                json=action.model_dump()
            )
            response.raise_for_status()
            logger.info(f"Action executed: {action.action}")
        except Exception as e:
            logger.error(f"Failed to execute action: {e}")
    
    def _format_sense_data_for_action(self, sense_data: SenseData) -> str:
        """Format sense data for the action selection model"""
        sense_json = sense_data.model_dump()
        return f"# Current Game State\n{json.dumps(sense_json, indent=2)}\n"
    
    def _format_data_for_chat(self, sense_data: SenseData, chosen_action: Action) -> str:
        """Format data for the chat response generation"""
        message = f"""
# Current Game State
{json.dumps(sense_data.model_dump(), indent=2)}

# Chosen Action
{json.dumps(chosen_action.model_dump(), indent=2)}

Generate a chat message that aligns with the chosen action. 
Respond in character as defined in your system instructions.
"""
        return message
    
    