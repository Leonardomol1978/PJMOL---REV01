from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.advogado import Advogado
from app.models.usuario import Usuario
from app.database import get_db
from app.utils.security import verificar_senha  # ✅ Função de verificação de senha

router = APIRouter()

# 📥 Modelo dos dados de login
class LoginData(BaseModel):
    usuario: str  # Pode ser e-mail ou nome de usuário
    senha: str

# 🔐 Rota única de login (advogado ou usuário)
@router.post("/login/")
def login(dados: LoginData, db: Session = Depends(get_db)):
    # 🔎 Tenta autenticar como advogado
    advogado = db.query(Advogado).filter(
        or_(
            Advogado.email == dados.usuario,
            Advogado.usuario == dados.usuario
        )
    ).first()

    if advogado and verificar_senha(dados.senha, advogado.senha_hash):
        return {
            "id": advogado.id,
            "nome": advogado.nome_completo,
            "usuario": advogado.usuario,
            "oab": advogado.oab,
            "email": advogado.email,
            "tipo": "advogado"
        }

    # 🔎 Tenta autenticar como usuário comum ou admin
    usuario = db.query(Usuario).filter(
        or_(
            Usuario.email == dados.usuario,
            Usuario.nome == dados.usuario
        )
    ).first()

    if usuario and verificar_senha(dados.senha, usuario.senha_hash):
        return {
            "id": usuario.id,
            "nome": usuario.nome,
            "email": usuario.email,
            "tipo": "admin" if usuario.is_admin else "usuario"
        }

    # ❌ Nenhuma correspondência encontrada
    raise HTTPException(status_code=401, detail="Credenciais inválidas")
