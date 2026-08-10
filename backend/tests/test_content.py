@pytest.fixture()
def lesson(session: FakeSession, branch: Branch) -> Lesson:
    lesson_obj = Lesson(id=uuid.uuid4(), branch_id=branch.id, title="Права и обязанности", sort_order=1)
    session.add_model(lesson_obj)
    return lesson_obj