import json
import time
import logging
import requests
import pydantic

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain.callbacks import get_openai_callback

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from control.settings import settings
from control.base_models import *

from .llm_node import LLMNode

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.WARNING)

class Controller:
    def __init__(self, character_prompt: str = "junko_prompt.txt") -> None:
        self.base_url = f"{settings.agent_origin}:{settings.agent_port}"
        self.total_prompt_tokens = 0
        self.total_completion_tokens = 0
        self.total_tokens = 0
        self.error_count = 0
        self.last_valid_response = None

        # Load character prompt
        with open(settings.prompt_template_dir / character_prompt, 'r') as f:
            system_prompt: str = f.read()


        # Initialize your LLM chain.
        model = ChatOpenAI(model=settings.openai_model, openai_api_key=settings.openai_api_key)
        parser = StrOutputParser()
        # Create the full prompt template (system + user).
        self.full_prompt_template = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("user", "{input}"),
        ])
        # Chain: prompt | model | parser
        self.llm_chain = self.full_prompt_template | model | parser

        # --- Set up LangGraph persistence ---
        self.checkpointer = MemorySaver()

        # Create a simple state graph with one node (our LLM node).
        self.graph = StateGraph(dict)
        llm_node = LLMNode(self.llm_chain)
        # Add a node that will process our input.
        self.graph.add_node("llm", llm_node)
        # Define the flow: START -> llm -> END.
        self.graph.add_edge(START, "llm")
        self.graph.add_edge("llm", END)
        # Compile the graph with persistence.
        self.compiled_graph = self.graph.compile(checkpointer=self.checkpointer)

    def think(self, sense_data: SenseData) -> Action:
        # Convert SenseData to JSON and create the incremental message.
        sense_json = sense_data.model_dump()
        message = f"# Sense Data\n{json.dumps(sense_json, indent=2)}\n"
        # Optionally append action schemas when needed.
        if self.error_count > 0 or self.last_valid_response is None:
            actions = [ChatAction, MoveAction, NullAction, DanceAction]
            action_schemas = [action.model_json_schema() for action in actions]
            message += f"\n# Actions\n{json.dumps(action_schemas, indent=2)}"

        # Create the input state for the graph.
        # On the first call, include the full system prompt (which is already in our LLM chain).
        # You could optionally merge an initial state here.
        state_input = {"input": message}

        # Define a configuration with a thread_id so that state persists across calls.
        config = {"configurable": {"thread_id": "1"}}

        with open('debug_log.txt', 'a') as f:
            f.write("\n\n=== New Message ===\n")
            f.write(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=== Input Message ===\n")
            f.write(message)


        # Invoke the graph. The checkpointer will save the state so that on subsequent calls
        # you could either retrieve it or only send incremental updates.
        with get_openai_callback() as cb:
            state_snapshot = self.compiled_graph.invoke(state_input, config=config)
            # Update token totals.
            self.total_prompt_tokens += cb.prompt_tokens
            self.total_completion_tokens += cb.completion_tokens
            self.total_tokens += cb.total_tokens

            print(f"\nCurrent call tokens - Total: {cb.total_tokens}")
            print(f"Prompt: {cb.prompt_tokens}")
            print(f"Completion: {cb.completion_tokens}")

            print(f"\nCumulative tokens - Total: {self.total_tokens}")
            print(f"Prompt: {self.total_prompt_tokens}")
            print(f"Completion: {self.total_completion_tokens}")

        # Retrieve the response from the state snapshot.
        response = state_snapshot.get("response", "")
        # Remove markdown code fences if present.
        if response.startswith('```'):
            response = response.split('\n', 1)[1]
            response = response.rsplit('\n', 1)[0]
            response = response.replace('```', '')

        try:
            parsed_response = json.loads(response)
            action = ActionType.validate_python(parsed_response)
            self.last_valid_response = action
            self.error_count = 0
            return action

        except json.JSONDecodeError as e:
            logger.error(f"LLM did not return valid JSON: {e}")
            logger.error(f"LLM response: {response}")
            self.error_count += 1
            return None

        except pydantic.ValidationError as e:
            logger.error(f"LLM did not return a valid action: {e}")
            logger.error(f"LLM response: {response}")
            self.error_count += 1
            return None

    def sense(self) -> SenseData:
        """Get the current state of the agent and environment."""
        try:
            response = requests.get(f"{self.base_url}/sense")
            response.raise_for_status()
            data = response.json()
            return SenseData(**data)

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to connect to agent: {e}, is the agent running?")
            return None

        except pydantic.ValidationError as e:
            logger.error(f"Invalid data received from agent: {e}, check compatibility.")
            return None

    def act(self, action: Action) -> None:
        """Dispatch an action to the agent."""
        try:
            logger.info(f"Received action: {action}")
            validated_action = ActionType.validate_python(action)
            logger.info(f"Validated action: {validated_action}")
        except pydantic.ValidationError as e:
            logger.error(f"Invalid action: {e}")
            return

        try:
            response = requests.post(f"{self.base_url}/act", 
                                     json=validated_action.model_dump())
            response.raise_for_status()

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to connect to agent: {e}, is the agent running?")
            return
