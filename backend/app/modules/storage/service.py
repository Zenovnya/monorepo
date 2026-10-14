"""Бизнес-логика хранения файлов в Cloudflare R2.

R2 совместим с S3 API, поэтому используется boto3.
Настройки через переменные окружения:
- R2_ACCOUNT_ID
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY
- R2_BUCKET_NAME
"""

import asyncio
import os
import uuid
from typing import Optional

# boto3 импортируется лениво, чтобы приложение стартовало без AWS SDK.
_boto3 = None


def _get_s3_client():
    global _boto3
    if _boto3 is None:
        import boto3  # noqa: PLC0415

        _boto3 = boto3.client(
            "s3",
            endpoint_url=f"https://{os.getenv('R2_ACCOUNT_ID', '')}.r2.cloudflarestorage.com",
            aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID", ""),
            aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY", ""),
            region_name="auto",
        )
    return _boto3


def _bucket() -> str:
    return os.getenv("R2_BUCKET_NAME", "")


def is_configured() -> bool:
    """Проверяет, настроен ли R2 (все ключи заданы)."""
    return bool(
        os.getenv("R2_ACCOUNT_ID")
        and os.getenv("R2_ACCESS_KEY_ID")
        and os.getenv("R2_SECRET_ACCESS_KEY")
        and os.getenv("R2_BUCKET_NAME")
    )


async def upload_file(
    content: bytes,
    filename: str,
    content_type: str,
    folder: str = "",
) -> Optional[str]:
    """Загружает файл в R2 и возвращает публичный URL.

    Возвращает None, если R2 не настроен.
    """
    if not is_configured():
        return None

    ext = os.path.splitext(filename)[1]
    key = f"{folder}/{uuid.uuid4().hex}{ext}".lstrip("/")

    try:
        client = _get_s3_client()
        # boto3 синхронный — выносим блокирующий вызов в отдельный поток,
        # чтобы не блокировать event loop на время загрузки.
        await asyncio.to_thread(
            client.put_object,
            Bucket=_bucket(),
            Key=key,
            Body=content,
            ContentType=content_type,
        )
        # Публичный URL (если bucket публичный).
        return f"https://pub-{os.getenv('R2_ACCOUNT_ID', '')}.r2.dev/{key}"
    except Exception:
        return None