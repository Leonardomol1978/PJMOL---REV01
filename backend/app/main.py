# main.py
import sys
import os
import json
import threading  # sublinhado de amarelo
import time       # sublinhado de amarelo
from app.database import get_db  # Caminho do seu arquivo que define a função get_db
from app.models import Extrato, Base
from app.models import Usuario
from fastapi import FastAPI, File, UploadFile, Request, HTTPException, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Union
from datetime import datetime
from dateutil.parser import parse  # ✅ Corrigido para suportar datas variadas
import traceback
import shutil
from PIL import Image, ImageEnhance, ImageFilter
from dateutil.relativedelta import relativedelta
from app.feedbacks.feedback import salvar_feedback
from app.extracao.leitura_pdf import extrair_dados_pdf, converter_pdf_para_imagens
from app.extracao.google_ai import ler_extrato_com_ia
from app.extracao.ocr_ajuste import ocr_ajuste
from app.utils.utils import instalar_dependencias
from app.exportar import exportar_dados_completos
from app.database import SessionLocal
from app.calculos.calculos_valores_backend import calcular_valor_corrigido
from app.calculos.config_calculo import ConfigCalculo, IndiceCorrecao
from app.routes import usuarios, login
from app.routes import login as login_router
from fastapi import Depends
from app import auth
from app.database import engine
from app.routes import privada  # privada.py está dentro da pasta app/routes
from starlette.concurrency import run_in_threadpool
from app.database import create_tables  # Importe a função create_tables
from app.routes import usuarios  # Certifique-se de importar corretamente suas rotas
from app.api.comarca import router as comarca_router
from app.api import comarca
from app.routes import advogado
from app.routes import documentos
from app.routes.usuarios import router as usuarios_router
from app.routes import documentos
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBasic, HTTPBasicCredentials



Base.metadata.create_all(bind=engine)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)
CAMINHO_JSON = os.path.join(BASE_DIR, "app", "dados", "administradoras.json")
with open(CAMINHO_JSON, "r", encoding="utf-8") as f:
    CNPJS_ADMINISTRADORAS = json.load(f)

app = FastAPI(
    title="API com Autenticação JWT",
    description="Exemplo de API com rotas públicas e protegidas",
    version="1.0.0"
)

security = HTTPBasic()

def verificar_autenticacao(credentials: HTTPBasicCredentials = Depends(security)):
    if not (credentials.username == "admin" and credentials.password == "senha123"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas",
            headers={"WWW-Authenticate": "Basic"},
        )
    return True

@app.get("/rota-protegida")
def rota_protegida(dep=Depends(verificar_autenticacao)):
    return {"mensagem": "Você está autenticado!"}

app.include_router(comarca.router)

app.include_router(usuarios_router)

app.include_router(advogado.router)

app.include_router(documentos.router)


# Rotas públicas (login, cadastro)

app.include_router(login.router)

# Rotas protegidas (exigem autenticação)
app.include_router(privada.router)

app.include_router(usuarios.router)
app.include_router(login_router.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/documentos", StaticFiles(directory="documentos_gerados"), name="documentos")

@app.post("/gerar-documentos")
def gerar_docs(dados: dict):
    return documentos.gerar_documentos(dados)

instalar_dependencias()

def aprimorar_imagem(caminho):
    try:
        imagem = Image.open(caminho).convert("L")
        imagem = imagem.filter(ImageFilter.MedianFilter(size=3))
        imagem = ImageEnhance.Contrast(imagem).enhance(2.0)
        imagem = imagem.point(lambda x: 0 if x < 128 else 255, '1')
        imagem.convert("RGB").save(caminho)
    except Exception as e:
        print(f"❌ Erro ao aprimorar imagem {caminho}: {e}")


def extrair_dados(caminho_pdf):
    print(f"\n📄 Lendo PDF: {caminho_pdf}")
    try:
        dados, parcelas = extrair_dados_pdf(caminho_pdf)
        # 🆔 Buscar CNPJ da administradora automaticamente
        nome_admin = dados.get("administradora", "").strip().upper()
        for nome_json in CNPJS_ADMINISTRADORAS:
            if nome_json.strip().upper() in nome_admin:
                dados["cnpj_administradora"] = CNPJS_ADMINISTRADORAS[nome_json]
                break
        else:
            dados["cnpj_administradora"] = ""

        db: Session = SessionLocal()
        if db.query(Extrato).filter_by(grupo=dados['grupo'], cota=dados['cota']).first():
            raise HTTPException(status_code=400, detail="Extrato já cadastrado")

        soma = round(sum(p.get("valor_pago", 0.0) for p in parcelas if p.get("valor_pago", 0.0) > 0), 2)
        total_pdf = dados.get("valor_total_pago_extrato") or 0.0
        diferenca = round(total_pdf - soma, 2)

        if diferenca != 0:
            imagens = converter_pdf_para_imagens(caminho_pdf)
            todas_parcelas = []
            for img_path in imagens:
                try:
                    aprimorar_imagem(img_path)
                    parcelas_ia = ler_extrato_com_ia(img_path)
                    if isinstance(parcelas_ia, list):
                        todas_parcelas.extend(parcelas_ia)
                except Exception as erro_ia:
                    print(f"❌ Erro IA em {img_path}: {erro_ia}")

            parcelas_filtradas = [
                p for p in todas_parcelas
                if p.get("data_pagamento") and p.get("valor_pago", 0.0) > 0.1 and round(p["valor_pago"], 2) not in [12.77, 8.64, 0.01]
            ]
            soma_ia = round(sum(p["valor_pago"] for p in parcelas_filtradas), 2)
            diferenca_final = round(total_pdf - soma_ia, 2)

            if abs(diferenca_final) > 0.01:
                candidatos = [p for p in todas_parcelas if abs(p.get("valor_pago", 0.0) - diferenca_final) < 2.0]
                if candidatos:
                    parcelas_filtradas.append(candidatos[0])

            if abs(diferenca_final) > 0.01:
                try:
                    encontrada = ocr_ajuste(caminho_pdf, parcelas_filtradas, diferenca_final)
                    if encontrada:
                        parcelas_filtradas.append(encontrada)
                        soma_ia = round(sum(p["valor_pago"] for p in parcelas_filtradas), 2)
                except Exception:
                    traceback.print_exc()

            dados["parcelas_detalhadas"] = parcelas_filtradas
            dados["parcelas_pagas"] = len(parcelas_filtradas)
            dados["soma_valores_pagos"] = soma_ia
        else:
            dados["parcelas_detalhadas"] = parcelas
            dados["parcelas_pagas"] = len([p for p in parcelas if p.get("valor_pago", 0.0) > 0])
            dados["soma_valores_pagos"] = soma

        # Cálculo da taxa de administração proporcional
        try:
            total_parcelas_plano = dados.get("total_parcelas_plano", 0)
            parcelas_pagas = dados.get("parcelas_pagas", 0)
            taxa_adm_percentual = dados.get("taxa_adm_percentual", 0.0)
            taxa_adm_devida = (parcelas_pagas / total_parcelas_plano) * taxa_adm_percentual if total_parcelas_plano > 0 else 0.0
            dados["taxa_adm_devida"] = round(taxa_adm_devida, 2)
        except Exception as e:
            print(f"[!] Erro ao calcular taxa_adm_devida: {e}")
            dados["taxa_adm_devida"] = 0.0

        return dados
    except HTTPException:
        raise
    except Exception:
        traceback.print_exc()
        return None
    
@app.get("/")
def status():
    return {"mensagem": "API do extrator com autenticação ativa"}

# [trecho omitido: importações]

@app.post("/extrair")
async def extrair(file: UploadFile = File(...)):
    try:
        os.makedirs("temp_uploads", exist_ok=True)
        caminho_pdf = os.path.join("temp_uploads", file.filename)

        with open(caminho_pdf, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Executa a extração principal
        dados = await run_in_threadpool(extrair_dados, caminho_pdf)
        if not dados:
            return {"erro": "Falha na extração"}

        # 🔄 Padroniza campos se necessário
        if "valor_total_taxa_adm_cobrada" in dados:
            dados["taxa_adm_cobrada_valor"] = dados["valor_total_taxa_adm_cobrada"]

        # ✅ Prepara dados_basicos com todos os campos extras calculados
        dados_basicos = {
            k: v for k, v in dados.items() if k not in ["parcelas_detalhadas"]
        }

        # 🧩 Insere valores calculados diretamente no dicionário de resposta
        for campo in [
            "valor_corrigido_hoje",
            "valor_corrigido_futuro",
            "valor_corrigido_hoje_liquido",
            "valor_corrigido_futuro_liquido",
            "valor_a_restituir",
            "percentual_taxa_adm_cobrada",
            "taxa_adm_cobrada_valor",
        ]:
            if campo in dados:
                dados_basicos[campo] = dados[campo]

        print("📦 DADOS EXTRAÍDOS:", dados)  # 🔍 Para conferência

        return {
            "dados_basicos": dados_basicos,
            "parcelas": dados.get("parcelas_detalhadas", []),
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        return {"erro": str(e)}


@app.post("/exportar")
async def exportar(request: Request):
    try:
        conteudo = await request.json()
        parcelas = conteudo.get("parcelas", [])
        dados = conteudo.get("dados_basicos", {})
        dados_manuais = conteudo.get("dados_manuais", {})
        dados["data_exportacao"] = datetime.now().isoformat()
        dados.update(dados_manuais)

        # Preenche campos financeiros finais
        try:
            juros = float(dados.get("taxa_juros_percentual", 0)) / 100
            honor = float(str(dados.get("honorarios_percentual", "0")).replace("%", "")) / 100
            adm = float(dados.get("taxa_administracao_deduzida", 0))
            outros = float(dados.get("valor_outros_custos", 0))

            if not dados.get("valor_com_juros_hoje"):
                dados["valor_com_juros_hoje"] = round(float(dados.get("valor_corrigido", 0)) * (1 + juros), 2)

            if not dados.get("valor_com_juros_futuro"):
                dados["valor_com_juros_futuro"] = round(float(dados.get("valor_futuro", 0)) * (1 + juros), 2)

            if not dados.get("honorarios_total_hoje"):
                dados["honorarios_total_hoje"] = round(float(dados["valor_com_juros_hoje"]) * honor, 2)

            if not dados.get("honorarios_total_futuro"):
                dados["honorarios_total_futuro"] = round(float(dados["valor_com_juros_futuro"]) * honor, 2)

            # ✅ NOVO: calcular valor corrigido líquido (antes dos honorários e custos)
            dados["valor_corrigido_liquido_hoje"] = round(dados["valor_com_juros_hoje"] - adm, 2)
            dados["valor_corrigido_liquido_futuro"] = round(dados["valor_com_juros_futuro"] - adm, 2)

            # ✅ Cálculo do valor final líquido após todas as deduções
            if not dados.get("valor_final_liquido_hoje"):
                dados["valor_final_liquido_hoje"] = round(
                    dados["valor_corrigido_liquido_hoje"] - dados["honorarios_total_hoje"] - outros, 2
                )

            if not dados.get("valor_final_liquido_futuro"):
                dados["valor_final_liquido_futuro"] = round(
                    dados["valor_corrigido_liquido_futuro"] - dados["honorarios_total_futuro"] - outros, 2
                )

        except Exception as e:
            print(f"[!] Erro ao calcular campos finais automaticamente: {e}")

        arquivos = exportar_dados_completos(parcelas, dados)
        return {"arquivos": arquivos, "data_exportacao": dados["data_exportacao"]}
    except Exception as e:
        return {"erro": str(e)}

class ParcelaInput(BaseModel):
    data_pagamento: str
    valor_pago: float
    tipo: Optional[str] = "parcela"

class DadosBasicos(BaseModel):
    grupo: str
    cota: str
    nome_cliente: str
    cpf_cnpj: str
    tipo_documento: str
    taxa_adm_percentual: float
    total_parcelas_plano: int
    data_encerramento: Optional[str] = None
    valor_total_pago_extrato: float
    administradora: str
    cep: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    valor_corrigido: Optional[Union[str, float]] = None
    valor_futuro: Optional[Union[str, float]] = None
    data_primeira_assembleia: Optional[str] = None
    valor_credito: Optional[float] = None

class DadosManuais(BaseModel):
    telefone: str
    advogado: str
    numero_processo: str
    honorarios_percentual: str
    fase_processo: str
    magistrado: str
    valor_corrigido: Optional[Union[str, float]] = None
    valor_futuro: Optional[Union[str, float]] = None
    data_inicio_juros: str
    taxa_juros_percentual: str
    houve_sentenca: bool
    data_sentenca: Optional[str] = None
    valor_outros_custos: Optional[str] = "0"
    indice_corrigido_hoje: Optional[str] = "TJMG"
    indice_corrigido_futuro: Optional[str] = "TJMG"

class CalculoRequest(BaseModel):
    parcelas: List[ParcelaInput]
    dados_basicos: DadosBasicos
    dados_manuais: DadosManuais

@app.post("/calcular")
async def calcular(calculo: CalculoRequest = Body(...)):
    try:
        parcelas_dict = [p.dict() for p in calculo.parcelas]

        if calculo.dados_manuais.houve_sentenca and calculo.dados_manuais.data_sentenca:
            data_sentenca_dt = datetime.strptime(calculo.dados_manuais.data_sentenca, "%Y-%m-%d")
            data_destino_hoje = data_sentenca_dt
            data_destino_futuro = data_sentenca_dt
        elif calculo.dados_basicos.data_encerramento:
            data_destino_hoje = datetime.today()
            data_destino_futuro = parse(calculo.dados_basicos.data_encerramento, dayfirst=True)
        elif calculo.dados_basicos.data_primeira_assembleia:
            try:
                try:
                    data_inicio = parse(calculo.dados_basicos.data_primeira_assembleia, dayfirst=True)
                except ValueError:
                    data_inicio = datetime.strptime(calculo.dados_basicos.data_primeira_assembleia, "%Y-%m-%d")
                data_destino_hoje = datetime.today()
                data_destino_futuro = data_inicio + relativedelta(months=+calculo.dados_basicos.total_parcelas_plano - 1)
            except Exception:
                raise HTTPException(status_code=400, detail="Data da primeira assembleia inválida")
        else:
            raise HTTPException(status_code=400, detail="Data de encerramento ou data da primeira assembleia é obrigatória")

        config = calcular_config_completo(calculo)

        resultado = calcular_valor_corrigido(
            parcelas=parcelas_dict,
            config=config,
            data_destino_hoje=data_destino_hoje.date(),
            data_destino_futuro=data_destino_futuro.date()
        )

        valor_pago_total = config.valor_total_pago_extrato
        taxa_adm_devida_valor = resultado.get("taxa_adm_devida_valor", 0.0)
        valor_a_restituir = valor_pago_total - taxa_adm_devida_valor

        parcelas_corrigidas = resultado.pop("parcelas_corrigidas", [])

        percentual_honorarios = config.percentual_honorarios / 100.0
        valor_base_hoje = resultado.get("valor_com_juros_hoje", resultado.get("valor_corrigido_hoje_liquido"))
        valor_base_futuro = resultado.get("valor_com_juros_futuro", resultado.get("valor_corrigido_futuro_liquido"))

        honorarios_adv_hoje = valor_base_hoje * percentual_honorarios / 2
        honorarios_emp_hoje = valor_base_hoje * percentual_honorarios / 2
        honorarios_adv_futuro = valor_base_futuro * percentual_honorarios / 2
        honorarios_emp_futuro = valor_base_futuro * percentual_honorarios / 2


        return {
            **resultado,
            "parcelas_corrigidas": parcelas_corrigidas,
            "honorarios_advogado_hoje": round(honorarios_adv_hoje, 2),
            "honorarios_advogado_futuro": round(honorarios_adv_futuro, 2),
            "honorarios_empresa_hoje": round(honorarios_emp_hoje, 2),
            "honorarios_empresa_futuro": round(honorarios_emp_futuro, 2),
            "valor_total_pago": round(valor_pago_total, 2),
            "valor_total_a_restituir": round(valor_a_restituir, 2),  # ✅ usado no frontend
            "taxa_adm_devida_valor": round(taxa_adm_devida_valor, 2)  # ✅ usado no frontend
        }

    except Exception as e:
        print(f"❌ Erro no cálculo: {e}")
        raise HTTPException(status_code=500, detail=str(e))



def calcular_config_completo(calculo):
    return ConfigCalculo(
        estado=calculo.dados_basicos.estado,
        data_sentenca=datetime.strptime(calculo.dados_manuais.data_sentenca, "%Y-%m-%d")
        if calculo.dados_manuais.houve_sentenca and calculo.dados_manuais.data_sentenca else None,
        aplicar_juros_mora=True,
        aplicar_juros=(
            float(calculo.dados_manuais.taxa_juros_percentual.replace(",", ".")) > 0.0
            if calculo.dados_manuais.taxa_juros_percentual else False
        ),
        data_inicio_juros=datetime.strptime(calculo.dados_manuais.data_inicio_juros, "%Y-%m-%d")
        if calculo.dados_manuais.data_inicio_juros else None,
        percentual_juros_mora_anual=float(calculo.dados_manuais.taxa_juros_percentual.replace(",", ".")) * 12
        if calculo.dados_manuais.taxa_juros_percentual else 0.0,
        taxa_juros_mensal_percentual=float(calculo.dados_manuais.taxa_juros_percentual.replace(",", "."))
        if calculo.dados_manuais.taxa_juros_percentual else 0.0,
        percentual_honorarios=float(calculo.dados_manuais.honorarios_percentual.replace("%", "").replace(",", "."))
        if calculo.dados_manuais.honorarios_percentual else 0.0,
        taxa_administracao_percentual_total=calculo.dados_basicos.taxa_adm_percentual,
        outros_custos=float(calculo.dados_manuais.valor_outros_custos.replace("R$", "").replace(",", ".").strip())
        if hasattr(calculo.dados_manuais, "valor_outros_custos") and calculo.dados_manuais.valor_outros_custos else 0.0,
        total_parcelas_plano=calculo.dados_basicos.total_parcelas_plano,
        valor_total_pago_extrato=calculo.dados_basicos.valor_total_pago_extrato,
        houve_sentenca=calculo.dados_manuais.houve_sentenca,
        indice_corrigido_hoje=calculo.dados_manuais.indice_corrigido_hoje or IndiceCorrecao.TJMG,
        indice_corrigido_futuro=calculo.dados_manuais.indice_corrigido_futuro or IndiceCorrecao.IPCA,
        valor_credito=calculo.dados_basicos.valor_credito or 0.0  # ✅ Esta linha deve estar aqui dentro
    )
