"""Отдача статической HTML-страницы админки контента.

Сама страница не содержит секретов — admin-токен вводится пользователем и
передаётся в заголовке ``X-Admin-Token`` при обращении к защищённым
эндпоинтам ``/admin/content/*``. Поэтому HTML отдаётся без авторизации.

Страница отдаётся с того же origin, что и API, — это избавляет от настройки
CORS: откройте ``/admin/ui`` в браузере и вставьте токен.
"""

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["admin"])

_UI_PATH = Path(__file__).resolve().parent / "ui.html"


@router.get("/admin/ui", response_class=HTMLResponse)
async def admin_ui() -> HTMLResponse:
    """Возвращает HTML-страницу веб-админки контента."""
    return HTMLResponse(_UI_PATH.read_text(encoding="utf-8"))
