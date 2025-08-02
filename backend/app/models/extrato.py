from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base  # Certifique-se de importar a Base correta

# Evita importações circulares em tempo de execução
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.models.usuario import Usuario

class Extrato(Base):
    __tablename__ = "extratos"

    id = Column(Integer, primary_key=True, autoincrement=True)

    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    usuario = relationship("Usuario", back_populates="extratos")

    grupo = Column(String, nullable=False)
    cota = Column(String, nullable=False)
    nome_cliente = Column(String, nullable=False)
    cpf_cnpj = Column(String, nullable=False)
    tipo_documento = Column(String, nullable=False)
    administradora = Column(String, nullable=False)

    taxa_adm_percentual = Column(Float, nullable=False)
    total_parcelas_plano = Column(Integer, nullable=False)
    data_encerramento = Column(Date, nullable=False)
    valor_total_pago_extrato = Column(Float, nullable=False)

    parcelas_pagas = Column(Integer, nullable=True)
    soma_valores_pagos = Column(Float, nullable=True)

    cidade = Column(String, nullable=True)
    estado = Column(String, nullable=True)
    telefone = Column(String, nullable=True)

    advogado = Column(String, nullable=True)
    numero_processo = Column(String, nullable=True)
    honorarios_percentual = Column(Float, nullable=True)
    fase_processo = Column(String, nullable=True)
    nome_magistrado = Column(String, nullable=True)

    valor_corrigido_hoje = Column(Float, nullable=True)
    valor_futuro = Column(Float, nullable=True)

    data_exportacao = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Extrato(grupo={self.grupo}, cota={self.cota}, cliente={self.nome_cliente})>"
