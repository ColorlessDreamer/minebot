from pydantic import BaseModel, TypeAdapter, Field
from typing import Optional, Literal, Union
from enum import Enum

# SenseData
###########


class BehaviorMode(str, Enum):
    IDLE = "IDLE"
    WANDERING = "WANDERING"
    FOLLOWING = "FOLLOWING"
    INTERACTING = "INTERACTING"
    ATTACKING = "ATTACKING"

class Message(BaseModel):
    username: str
    message: str


class Entity(BaseModel):
    entityID: str
    type: str
    username: str | None

class DamageInfo(BaseModel):
    attacker: Optional[dict] = Field(
        None,
        description="Information about the attacking entity if known"
    )
    health: float
    timestamp: int

class SenseData(BaseModel):
    last_message: Optional[Message]
    last_damage: Optional[DamageInfo]
    is_raining: bool
    is_day: bool
    entities: list[Entity]
    current_behavior: BehaviorMode





# Actions
#########


class ChatAction(BaseModel):
    action: Literal["chat"] = Field(..., description="Announce a message to the world.")
    message: str

class AttackAction(BaseModel):
    action: Literal["attack"] = Field(..., description="Attack an entity")
    entityID: str = Field(..., description="Target entity to attack")


class MoveAction(BaseModel):
    action: Literal["move"] = Field(..., description="Move towards an entity.")
    entityID: str = Field(..., alias="target")
    follow: bool = Field(default=False, description="Continue following after reaching target")

    class Config:
        populate_by_name = True


class WanderAction(BaseModel):
    action: Literal["wander"] = Field(..., description="Start/stop wandering behavior")
    enabled: bool = Field(default=True, description="True to start wandering, False to stop")


class DanceAction(BaseModel):
    action: Literal["dance"] = Field(..., description="Perform a dance pattern")
    style: str = Field(default="spin", description="Dance style: spin, jump, etc.")

class NullAction(BaseModel):
    action: Literal["null"] = Field(..., description="Stop current movement")

Action = Union[ChatAction, MoveAction, DanceAction, NullAction, WanderAction, AttackAction]

ActionType = TypeAdapter(Action)
