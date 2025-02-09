from pydantic import BaseModel, TypeAdapter, Field
from typing import Optional, Literal, Union

# SenseData
###########


class Message(BaseModel):
    username: str
    message: str


class Entity(BaseModel):
    entityID: str
    type: str
    username: str | None



class SenseData(BaseModel):
    last_message: Optional[Message]
    last_damage: Optional[DamageInfo]
    is_raining: bool
    is_day: bool
    entities: list[Entity]


class DamageInfo(BaseModel):
    attacker: Optional[dict] = Field(
        None,
        description="Information about the attacking entity if known"
    )
    health: float
    timestamp: int


# Actions
#########


class ChatAction(BaseModel):
    action: Literal["chat"] = Field(..., description="Announce a message to the world.")
    message: str


class MoveAction(BaseModel):
    action: Literal["move"] = Field(..., description="Move towards an entity.")
    entityID: str = Field(..., alias="target")
    follow: bool = Field(default=False, description="Continue following after reaching target")

class DanceAction(BaseModel):
    action: Literal["dance"] = Field(..., description="Perform a dance pattern")
    style: str = Field(default="spin", description="Dance style: spin, jump, etc.")

class NullAction(BaseModel):
    action: Literal["null"] = Field(..., description="Stop current movement")

Action = Union[ChatAction, MoveAction, DanceAction, NullAction]

ActionType = TypeAdapter(Action)
