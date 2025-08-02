from fastapi import APIRouter, Depends, HTTPException, status, Path
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.models.usuario import Usuario
from app.database import get_db
from app.utils.security import gerar_hash_senha, verificar_senha

router = APIRouter()

# 📌 Modelo Pydantic para criação de usuário
class UsuarioCreate(BaseModel):
    nome: str
    email: str
    senha: str
    perfil: str = "usuario"  # admin | usuario | restrito

# ✅ Endpoint para criar usuário
@router.post("/usuarios/", status_code=status.HTTP_201_CREATED)
def criar_usuario(dados: UsuarioCreate, db: Session = Depends(get_db)):
    try:
        if db.query(Usuario).filter(Usuario.email == dados.email).first():
            raise HTTPException(status_code=400, detail="E-mail já cadastrado")

        usuario = Usuario(
            nome=dados.nome,
            email=dados.email,
            senha_hash=gerar_hash_senha(dados.senha),
            is_admin=(dados.perfil == "admin")
        )

        db.add(usuario)
        db.commit()
        db.refresh(usuario)
        return {"mensagem": "Usuário cadastrado com sucesso", "id": usuario.id}

    except Exception as e:
        print("Erro ao cadastrar usuário:", e)
        raise HTTPException(status_code=500, detail="Erro interno ao cadastrar usuário")

# 🔐 Endpoint para login de usuário
@router.post("/usuarios/login/")
def login_usuario(credenciais: dict, db: Session = Depends(get_db)):
    email = credenciais.get("usuario")
    senha = credenciais.get("senha")

    usuario = db.query(Usuario).filter(Usuario.email == email).first()
    if not usuario or not verificar_senha(senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    return {
        "id": usuario.id,
        "nome": usuario.nome,
        "email": usuario.email,
        "perfil": "admin" if usuario.is_admin else "usuario"
    }

@router.get("/usuarios/quantidade")
def contar_usuarios(db: Session = Depends(get_db)):
    total = db.query(Usuario).count()
    return {"total_usuarios": total}

@router.delete("/usuarios/{email}")
def deletar_usuario(email: str = Path(...), db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.email == email).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    db.delete(usuario)
    db.commit()
    return {"mensagem": f"Usuário {email} removido com sucesso"}

@router.get("/usuarios/")
def listar_usuarios(db: Session = Depends(get_db)):
    return db.query(Usuario).all()

@router.get("/usuarios/admins")
def listar_usuarios_admins(db: Session = Depends(get_db)):
    admins = db.query(Usuario).filter(Usuario.is_admin == True).all()
    return [
        {
            "id": usuario.id,
            "nome": usuario.nome,
            "email": usuario.email,
            "criado_em": usuario.criado_em
        }
        for usuario in admins
    ]