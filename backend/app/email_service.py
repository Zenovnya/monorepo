"""Отправка писем через Resend.

Единственная точка интеграции с почтовым провайдером. Если ``RESEND_API_KEY``
не задан, письма не отправляются: приложение продолжает работать, а
``/auth/forgot-password`` отвечает так же, как при успешной отправке (иначе
перебором можно было бы выяснить, какие email зарегистрированы).
"""

from __future__ import annotations

import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

RESEND_ENDPOINT = "https://api.resend.com/emails"
REQUEST_TIMEOUT_SECONDS = 10.0


class EmailNotConfiguredError(Exception):
    """Почтовый провайдер не настроен (нет API-ключа)."""


def is_email_configured() -> bool:
    """Готов ли сервис отправлять письма."""
    return bool(get_settings().resend_api_key)


async def send_email(*, to: str, subject: str, html: str, text: str) -> None:
    """Отправляет письмо через Resend.

    Бросает ``EmailNotConfiguredError``, если ключ не задан, и
    ``httpx.HTTPError`` при сетевой/HTTP-ошибке — вызывающая сторона решает,
    показывать ли это пользователю (для сброса пароля — нет).
    """
    settings = get_settings()
    if not settings.resend_api_key:
        raise EmailNotConfiguredError("RESEND_API_KEY не задан")

    payload = {
        "from": settings.email_from,
        "to": [to],
        "subject": subject,
        "html": html,
        "text": text,
    }

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
        response = await client.post(
            RESEND_ENDPOINT,
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
        )
        if response.status_code >= 400:
            # Тело ответа Resend содержит причину (неподтверждённый домен,
            # невалидный ключ) — пишем в лог, но без ключа и без PII.
            logger.warning(
                "Resend отклонил письмо: %s %s",
                response.status_code,
                response.text[:300],
            )
            response.raise_for_status()


def build_password_reset_email(*, name: str, link: str, ttl_minutes: int) -> dict:
    """Возвращает (subject, html, text) письма со ссылкой сброса пароля."""
    safe_name = (name or "юрист").strip() or "юрист"
    subject = "Сброс пароля в «Лапе закона»"

    text = (
        f"Здравствуйте, {safe_name}!\n\n"
        "Вы запросили сброс пароля в приложении «Лапа закона».\n"
        f"Ссылка действует {ttl_minutes} минут и срабатывает один раз:\n\n"
        f"{link}\n\n"
        "Если вы не запрашивали сброс, просто проигнорируйте это письмо — "
        "пароль останется прежним.\n"
    )

    html = f"""\
<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:24px;background:#F7EFDF;font-family:-apple-system,
               BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="max-width:520px;margin:0 auto;background:#FCF8F0;
                  border:2px solid #D9A849;border-radius:16px;">
      <tr>
        <td style="padding:28px 26px;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:1.6px;
                    text-transform:uppercase;color:#6E5F4F;">
            Лапа закона
          </p>
          <h1 style="margin:0 0 14px;font-size:22px;color:#302820;">
            Сброс пароля
          </h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:22px;color:#302820;">
            Здравствуйте, {safe_name}! Вы запросили сброс пароля.
          </p>
          <p style="margin:0 0 22px;">
            <a href="{link}"
               style="display:inline-block;padding:13px 22px;border-radius:12px;
                      background:#C9362B;color:#FCF8F0;text-decoration:none;
                      font-weight:700;font-size:15px;">
              Задать новый пароль
            </a>
          </p>
          <p style="margin:0 0 8px;font-size:13px;line-height:19px;color:#6E5F4F;">
            Ссылка действует {ttl_minutes} минут и срабатывает один раз.
          </p>
          <p style="margin:0;font-size:13px;line-height:19px;color:#6E5F4F;">
            Если вы не запрашивали сброс, просто проигнорируйте письмо —
            пароль останется прежним.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
"""

    return {"subject": subject, "html": html, "text": text}
