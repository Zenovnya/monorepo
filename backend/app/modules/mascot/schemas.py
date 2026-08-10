"""Pydantic-схемы модуля маскота."""

import uuid

from pydantic import BaseModel, ConfigDict


class MascotPhraseRead(BaseModel):
    """Фраза маскота для списка (GET /mascot/phrases)."""

    id: uuid.UUID
    trigger: str
    phrase: str
    emotion: str
    weight: int

    model_config = ConfigDict(from_attributes=True)


class PhraseRead(BaseModel):
    """Фраза маскота для показа (GET /mascot/phrase/{trigger})."""

    id: uuid.UUID
    phrase: str
    emotion: str

    model_config = ConfigDict(from_attributes=True)


class PetCountRead(BaseModel):
    """Счётчик поглаживаний маскота (POST /pet, GET /pet-count)."""

    pet_count: int