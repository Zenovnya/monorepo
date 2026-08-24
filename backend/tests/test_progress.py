@pytest.fixture()
def lesson(session: FakeSession) -> Lesson:
    lesson = Lesson(id=uuid.uuid4(), branch_id=uuid.uuid4(), title="Права", sort_order=1)
    session.add_model(lesson)
    return lesson