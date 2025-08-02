from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    senha_hash = Column(String, nullable=False)
    criado_em = Column(DateTime, default=datetime.utcnow)
    is_admin = Column(Boolean, default=False)

    extratos = relationship("Extrato", back_populates="usuario")

    def __repr__(self):
        return f"<Usuario(nome={self.nome}, email={self.email}, admin={self.is_admin})>"
