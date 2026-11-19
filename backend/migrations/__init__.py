"""Пакет миграций Alembic.

Здесь лежат только ``versions/`` и конфигурация — модели описаны в
``app/modules/*/models.py``. Пустой ``__init__.py`` нужен, чтобы Alembic
импортировал каталог как пакет и ``env.py`` мог обращаться к ``alembic.context``
без «No module named migrations».
"""
