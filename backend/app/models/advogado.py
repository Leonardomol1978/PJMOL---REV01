from sqlalchemy import Column, Integer, String
from app.database import Base

class Advogado(Base):
    __tablename__ = "advogados"

    id = Column(Integer, primary_key=True, index=True)
    nome_completo = Column(String, nullable=False)
    oab = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True)
    telefone = Column(String, nullable=False)
    usuario = Column(String, nullable=False, unique=True)
    senha_hash = Column(String, nullable=False)
    api_key_zapsign = Column(String, nullable=True)
