from fastapi import APIRouter, HTTPException
import requests
import json
from pathlib import Path
import unicodedata
from pydantic import BaseModel

router = APIRouter()

# Caminhos dos arquivos
CAMINHO_COMARCAS = Path(__file__).resolve().parent / "../dados/comarcas_por_uf.json"
CAMINHO_ADMINISTRADORAS = Path(__file__).resolve().parent / "../dados/administradoras.json"

# Função de normalização
def normalizar(texto: str) -> str:
    return unicodedata.normalize("NFKD", texto).encode("ASCII", "ignore").decode("ASCII").upper().strip()

# Carrega as comarcas em memória
try:
    with open(CAMINHO_COMARCAS, encoding="utf-8") as f:
        bruto = json.load(f)
        COMARCAS = {}
        for uf, lista in bruto.items():
            COMARCAS[uf] = {}
            for item in lista:
                municipio = normalizar(item["municipio"])
                comarca = item["comarca"].strip().upper()
                COMARCAS[uf][municipio] = f"COMARCA DE {comarca} - {uf}"
except Exception as e:
    raise RuntimeError(f"Erro ao carregar o arquivo de comarcas: {e}")


# Rota 1: Obter comarca pelo CEP
@router.get("/comarca-por-cep/{cep}")
def obter_comarca_por_cep(cep: str):
    try:
        cep_limpo = ''.join(filter(str.isdigit, cep))
        via_cep = requests.get(f"https://viacep.com.br/ws/{cep_limpo}/json/")

        if via_cep.status_code != 200:
            raise HTTPException(status_code=404, detail="CEP inválido ou não encontrado")

        dados = via_cep.json()
        if "erro" in dados:
            raise HTTPException(status_code=404, detail="CEP não encontrado no ViaCEP")

        cidade = normalizar(dados.get("localidade", ""))
        uf = dados.get("uf", "").strip().upper()

        if not cidade or not uf:
            raise HTTPException(status_code=400, detail="Município ou UF não encontrados")

        comarca = COMARCAS.get(uf, {}).get(cidade)
        if not comarca:
            raise HTTPException(status_code=404, detail=f"Comarca não encontrada para {cidade} - {uf}")

        return {"comarca": comarca}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


# Modelo para nome de administradora
class NomeAdministradora(BaseModel):
    nome_administradora: str

# Rota 2: Buscar CNPJ pelo nome da administradora
@router.post("/cnpj-por-administradora")
def buscar_cnpj_por_nome(payload: NomeAdministradora):
    nome_busca = normalizar(payload.nome_administradora)
    try:
        with open(CAMINHO_ADMINISTRADORAS, encoding="utf-8") as f:
            administradoras = json.load(f)

        for nome, cnpj in administradoras.items():
            if normalizar(nome) == nome_busca:
                return {"cnpj": ''.join(filter(str.isdigit, cnpj))}
        return {"cnpj": None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar CNPJ: {str(e)}")


# Rota 3: Buscar nome da administradora e comarca pelo CNPJ
@router.get("/administradora-por-cnpj/{cnpj}")
def obter_administradora_por_cnpj(cnpj: str):
    try:
        cnpj_limpo = ''.join(filter(str.isdigit, cnpj))
        if len(cnpj_limpo) != 14:
            raise HTTPException(status_code=400, detail="CNPJ inválido")

        nome_adm = None
        cep = None

        # 1. Tenta buscar na BrasilAPI
        try:
            resposta = requests.get(f"https://brasilapi.com.br/api/cnpj/v1/{cnpj_limpo}")
            if resposta.status_code == 200:
                dados = resposta.json()
                nome_adm = normalizar(dados.get("razao_social", ""))
                cep = dados.get("cep", "").strip()
        except:
            pass

        # 2. Fallback local
        if not nome_adm:
            with open(CAMINHO_ADMINISTRADORAS, encoding="utf-8") as f:
                administradoras = json.load(f)
                for nome, cnpj_salvo in administradoras.items():
                    if ''.join(filter(str.isdigit, cnpj_salvo)) == cnpj_limpo:
                        nome_adm = normalizar(nome)
                        break

        if not nome_adm:
            raise HTTPException(status_code=404, detail="CNPJ não encontrado")

        # 3. Buscar comarca pelo CEP, se disponível
        comarca = None
        if cep:
            try:
                resposta_comarca = requests.get(f"http://localhost:8000/comarca-por-cep/{cep}")
                if resposta_comarca.status_code == 200:
                    comarca_data = resposta_comarca.json()
                    comarca = comarca_data.get("comarca", "")
            except:
                pass

        return {
            "administradora": nome_adm,
            "cep": cep,
            "comarca": comarca
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


# Rota 4: Buscar somente a comarca via CNPJ (usada pelo frontend)
@router.get("/comarca-por-cnpj/{cnpj}")
def buscar_comarca_por_cnpj(cnpj: str):
    try:
        cnpj_limpo = ''.join(filter(str.isdigit, cnpj))
        if len(cnpj_limpo) != 14:
            raise HTTPException(status_code=400, detail="CNPJ inválido")

        resposta = requests.get(f"http://localhost:8000/administradora-por-cnpj/{cnpj_limpo}")
        if resposta.status_code != 200:
            raise HTTPException(status_code=404, detail="Não foi possível determinar a comarca")

        dados = resposta.json()
        return {"comarca": dados.get("comarca", "")}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")
