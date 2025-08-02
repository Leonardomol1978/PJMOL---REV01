from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date, datetime


class UsuarioCreate(BaseModel):
    nome: str
    email: EmailStr
    senha: str


class UsuarioLogin(BaseModel):
    email: EmailStr
    senha: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginInput(BaseModel):
    email: EmailStr
    senha: str


class UsuarioOut(BaseModel):
    nome: str
    email: EmailStr

    class Config:
        orm_mode = True


# Você pode usar isso para respostas ou formulários relacionados ao Extrato:
class ExtratoBase(BaseModel):
    grupo: str
    cota: str
    nome_cliente: str
    email_cliente: Optional[EmailStr] = None
    cpf_cnpj: str
    tipo_documento: str
    administradora: str
    cidade: Optional[str]
    estado: Optional[str]
    telefone: Optional[str]
    rua: Optional[str]
    numero: Optional[str]
    complemento: Optional[str]
    bairro: Optional[str]
    cep: Optional[str]
    data_adesao: Optional[date]
    comarca_cliente: Optional[str]
    comarca_administradora: Optional[str]
    total_parcelas_plano: int
    data_encerramento: date
    valor_total_pago_extrato: float
    taxa_adm_percentual: float

    # Novos campos para seleção de índice de correção
    indice_corrigido_hoje: Optional[str] = "TJMG"
    indice_corrigido_futuro: Optional[str] = "TJMG"

    class Config:
        orm_mode = True
