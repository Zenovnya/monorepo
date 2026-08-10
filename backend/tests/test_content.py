class FakeSession:
    """Минимальная фейковая асинхронная сессия для тестов сервиса."""

    def __init__(self) -> None:
        self._objects: dict[type, dict[uuid.UUID, Any]] = {}

    def _all_of(self, model: type) -> list[Any]:
        return list(self._objects.get(model, {}).values())

    def add_model(self, obj: Any) -> None:
        self._objects.setdefault(type(obj), {})[obj.id] = obj

    async def get(self, model: type, ident: Any) -> Any:
        return self._objects.get(model, {}).get(ident)

    async def scalars(self, statement: Any) -> FakeScalarResult:
        # Определяем модель, по которой выполняется select, и возвращаем
        # соответствующие сохранённые объекты.
        entity = statement.column_descriptions[0]["entity"]
        return FakeScalarResult(self._all_of(entity))