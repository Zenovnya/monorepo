"lessons": [
                    {
                        "id": lesson.id,
                        "title": lesson.title,
                        "order": lesson.order,
                        "xp_reward": lesson.xp_reward,
                        "completed": bool(
                            progress_map.get(lesson.id)
                            and progress_map[lesson.id].completed
                        ),
                    }
                    for lesson in lessons
                ],