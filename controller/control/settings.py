from pydantic_settings import BaseSettings
from pathlib import Path

    
class Settings(BaseSettings):
    # Agent settings
    agent_origin: str = "http://localhost"
    agent_port: int = 3000
    prompt_template_dir: Path = Path(__file__).parent.parent / "prompts"
    system_prompt_file: Path = prompt_template_dir / "system_prompt.txt"

    # OpenAI configuration with defaults
    openai_api_key: str
    action_model: str = "gpt-3.5-turbo"  # Add this
    chat_model: str = "gpt-4o"  # Add this

    class Config:
        env_file = str(Path(__file__).parent.parent / '.env')

settings = Settings()
