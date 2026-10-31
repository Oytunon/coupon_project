"""
Turnuva görsellerinin küçük kopyaları.

Yüklenen görseller 1080px ve ~1 MB; üye sitesindeki kartlar ise en fazla ~280px gösteriyor.
Küçük WebP kopya ilk istendiğinde üretilip diske yazılır, sonraki istekler doğrudan dosyadan döner.
Üretilemezse 404 döner ve istemci orijinal görsele düşer (görsel hiçbir durumda kırılmaz).
"""
import logging
import os
import re
import threading
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

logger = logging.getLogger("backend_api")

router = APIRouter(tags=["media"])

MEDIA_DIR = "media"
THUMB_DIR = os.path.join(MEDIA_DIR, "thumb")
# Yalnızca istemcinin kullandığı genişlik; keyfi boyutlar üretilip disk doldurulamasın
ALLOWED_WIDTHS = {"600"}
# Yalnızca media klasörünün kendisindeki dosyalar (alt klasör, "..", ayraç yok)
_SAFE_FILENAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]*\.[A-Za-z0-9]+$")

# Aynı görsele aynı anda gelen istekler: biri üretir, diğerleri bekleyip hazır dosyayı alır
_build_locks: dict = {}
_build_locks_guard = threading.Lock()


def _lock_for(path: str) -> threading.Lock:
    with _build_locks_guard:
        return _build_locks.setdefault(path, threading.Lock())


@router.get("/media/thumb/{width}/{filename}")
def get_media_thumbnail(width: str, filename: str):
    if width not in ALLOWED_WIDTHS or not _SAFE_FILENAME.match(filename):
        raise HTTPException(404, "Not Found")

    source = os.path.join(MEDIA_DIR, filename)
    if not os.path.isfile(source):
        raise HTTPException(404, "Not Found")

    target = os.path.join(THUMB_DIR, width, f"{filename}.webp")
    if not os.path.isfile(target):
        with _lock_for(target):
            if not os.path.isfile(target):
                try:
                    _build_thumbnail(source, target, int(width))
                except Exception as e:
                    logger.warning(f"Küçük görsel üretilemedi ({filename}): {e}")
                    raise HTTPException(404, "Not Found")

    # Kaynak dosya adı benzersiz (event_{id}_{uuid}); aynı adres hiç farklı içerik vermez
    return FileResponse(target, media_type="image/webp", headers={"Cache-Control": "public, max-age=31536000, immutable"})


def _build_thumbnail(source: str, target: str, width: int) -> None:
    # Pillow yalnızca burada yüklenir; kurulu değilse uygulama yine açılır, sadece bu uç 404 döner
    from PIL import Image, ImageOps

    os.makedirs(os.path.dirname(target), exist_ok=True)
    tmp = f"{target}.{uuid.uuid4().hex}.tmp"
    try:
        with Image.open(source) as img:
            # Telefon fotoğraflarındaki döndürme bilgisi uygulansın (tarayıcı orijinalde uyguluyor)
            thumb = ImageOps.exif_transpose(img)
            thumb.thumbnail((width, width))  # oranı korur, küçük görseli büyütmez
            if thumb.mode not in ("RGB", "RGBA"):
                has_alpha = thumb.mode in ("LA", "PA") or "transparency" in thumb.info
                thumb = thumb.convert("RGBA" if has_alpha else "RGB")
            thumb.save(tmp, "WEBP", quality=80, method=4)
        # Aynı anda gelen iki istek aynı dosyayı yazsa da yarım dosya hiç sunulmaz
        os.replace(tmp, target)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
