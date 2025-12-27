from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.deps import get_db
from common.models.participant import Participant
from app.services.bapi_deposit_service import has_single_deposit_1000, fetch_client_id_by_login

router = APIRouter(prefix="/api")


@router.get("/has-joined")
async def has_joined(
    username: Optional[str] = None,
    client_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Kullanıcının turnuvaya katılıp katılmadığını kontrol eder.
    username (login) veya client_id kullanılabilir.
    """
    # Username verilmişse client_id'ye çevir
    if username:
        resolved_client_id = await fetch_client_id_by_login(username)
        if not resolved_client_id:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        client_id = resolved_client_id
    elif not client_id:
        raise HTTPException(status_code=400, detail="Username veya client_id gereklidir")
    
    exists = db.query(Participant).filter_by(client_id=client_id).first()
    return {"can_join": exists is None}


@router.post("/join")
async def join_tournament(
    username: Optional[str] = None,
    client_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Turnuvaya katılım sağlar.
    Kullanıcının yatırım şartını (1000 TL) kontrol eder.
    """
    # Username verilmişse client_id'ye çevir
    resolved_username = username
    if username:
        resolved_client_id = await fetch_client_id_by_login(username)
        if not resolved_client_id:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        client_id = resolved_client_id
    elif not client_id:
        raise HTTPException(status_code=400, detail="Username veya client_id gereklidir")
    else:
        resolved_username = None
    
    exists = db.query(Participant).filter_by(client_id=client_id).first()
    if exists:
        raise HTTPException(status_code=400, detail="Kullanıcı zaten katılmış")

    # Yatırım kontrolü (Tek seferde >= 1000 TL)
    eligible = await has_single_deposit_1000(client_id)
    if not eligible:
        raise HTTPException(
            status_code=403,
            detail="Bu ay tek seferde minimum 1000 TL yatırım şartı sağlanmamış"
        )

    # Katılımcıyı kaydet
    db.add(Participant(client_id=client_id, username=resolved_username))
    db.commit()

    return {"status": "joined"}
