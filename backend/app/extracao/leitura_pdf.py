import os
import fitz  # PyMuPDF
import pdfplumber
from pdf2image import convert_from_path
from ..utils.utils import limpar_texto
import pytesseract
import re
import requests
import json
from difflib import get_close_matches
from app.aprendizado.aprendizado import ler_aprendizado, salvar_aprendizado
from .google_ai import ler_extrato_com_ia
from datetime import datetime
from dateutil.relativedelta import relativedelta




# Caminho do JSON
CAMINHO_JSON = "app/dados/administradoras.json"

# Carrega o dicionário {nome: cnpj}
with open(CAMINHO_JSON, "r", encoding="utf-8") as f:
    mapa_administradoras = json.load(f)

# Lista com os nomes para comparação
administradoras_conhecidas = list(mapa_administradoras.keys())

def normalizar_nome_administradora(nome_extraido: str) -> str:
    """
    Compara o nome extraído com a lista de administradoras conhecidas
    e retorna a correspondência mais próxima.
    """
    nome_extraido = nome_extraido.upper().strip()
    candidatos = get_close_matches(nome_extraido, administradoras_conhecidas, n=1, cutoff=0.6)
    return candidatos[0] if candidatos else nome_extraido

    nome_normalizado = normalizar_nome_administradora(nome_extraido)
    dados_extraidos["administradora"] = nome_normalizado



def buscar_cidade_estado_por_cep(cep):
    cep = re.sub(r'\D', '', cep)
    if not cep or len(cep) != 8:
        return "", ""
    try:
        response = requests.get(f"https://viacep.com.br/ws/{cep}/json/")
        if response.status_code == 200:
            dados = response.json()
            cidade = dados.get("localidade", "").upper()
            estado = dados.get("uf", "").upper()
            return cidade, estado
    except:
        pass
    return "", ""

def extrair_administradora_primeira_pagina(caminho_pdf):
    try:
        primeira_pagina = convert_from_path(caminho_pdf, dpi=200, first_page=1, last_page=1)[0]
        largura, altura = primeira_pagina.size
        topo = primeira_pagina.crop((0, 0, largura, int(altura * 0.10))).convert("L")
        topo = topo.point(lambda x: 0 if x < 180 else 255, '1')
        texto = pytesseract.image_to_string(topo, lang="por")
        for linha in texto.strip().splitlines():
            if not linha.strip(): continue
            linha_limpa = re.sub(r"^\d{3,5}\s*", "", linha)
            corte = re.split(r"(Grupo:|Cota:|Contrato|CPF|Cliente|Extrato)", linha_limpa, maxsplit=1, flags=re.IGNORECASE)[0]
            match = re.search(r"([A-Z\s&\.]+(?:ADMINISTRADORA|CONS[ÓO]RCIOS|LTDA|S/A|CONSORCIO)[^|]*)", corte, re.IGNORECASE)
            if match:
                nome = match.group(1).strip()
                return normalizar_nome_administradora(' '.join(w.capitalize() for w in nome.split()))
        return ""
    except Exception as e:
        print(f"❌ Erro ao extrair administradora da primeira página: {e}")
        return ""

def extrair_texto_pdfplumber(caminho_pdf):
    texto = ""
    with pdfplumber.open(caminho_pdf) as pdf:
        for pagina in pdf.pages:
            texto += pagina.extract_text() or ""
            texto += "\n"
    return texto

def extrair_texto_fitz(caminho_pdf):
    texto = ""
    doc = fitz.open(caminho_pdf)
    for pagina in doc:
        texto += pagina.get_text()
        texto += "\n"
    return texto

def ocr_pdf_completo(caminho_pdf):
    imagens = convert_from_path(caminho_pdf, dpi=300)
    texto_ocr = ""
    for img in imagens:
        texto_ocr += pytesseract.image_to_string(img, lang="por") + "\n"
    return texto_ocr

def converter_pdf_para_imagens(caminho_pdf):
    imagens = convert_from_path(caminho_pdf, dpi=200)
    caminhos = []
    os.makedirs("imagens", exist_ok=True)
    for i, img in enumerate(imagens):
        caminho_img = f"imagens/pagina_{i+1}.png"
        img.save(caminho_img, "PNG")
        caminhos.append(caminho_img)
    return caminhos

def extrair_parcelas_conta_corrente(texto):
    dentro_conta_corrente = False
    parcelas = []
    for linha in texto.splitlines():
        linha = linha.strip()
        if "Conta Corrente" in linha:
            dentro_conta_corrente = True
            continue
        if dentro_conta_corrente and (
            "Pendência" in linha or "VALORES / PERCENTUAIS PAGOS" in linha or
            "VALORES/ PERCENTUAIS PAGOS" in linha or "Valores / Percentuais Pagos" in linha or "TOTAL" in linha):
            break
        if dentro_conta_corrente:
            data_match = re.search(r"\d{2}/\d{2}/\d{4}", linha)
            valor_match = re.findall(r"\d+\.\d{2}|\d+,\d{2}", linha)
            if data_match and valor_match:
                data = data_match.group()
                valor_str = valor_match[-1].replace(".", "").replace(",", ".")
                valor = float(valor_str)
                if "RECBTO. PARCELA" in linha.upper():
                    parcelas.append({"data_pagamento": data, "valor_pago": valor})
                else:
                    parcelas.append({"data_pagamento": data, "valor_pago": valor, "tipo": "ajuste"})
    return parcelas

def extrair_dados_pdf(caminho_pdf):
    print(f"Lendo o PDF: {caminho_pdf}")

    texto = extrair_texto_pdfplumber(caminho_pdf)
    if not texto.strip():
        texto = extrair_texto_fitz(caminho_pdf)
    if not texto.strip():
        print("⚠️ PDF sem texto, usando OCR completo...")
        texto = ocr_pdf_completo(caminho_pdf)

    texto = limpar_texto(texto)
    dados = {}
    aprendizado_campo = {}

    try:
        grupo_cota = re.search(r"Grupo:\s*(\d+)\s*Cota:\s*([\d\-]+)", texto)
        if grupo_cota:
            dados["grupo"] = grupo_cota.group(1)
            dados["cota"] = grupo_cota.group(2)

        nome_cliente = re.search(r"Cota:\s*[\d\-]+\s*(.*?)\s*Contrato", texto)
        if nome_cliente:
            dados["nome_cliente"] = nome_cliente.group(1).strip()

        cpf_cnpj = re.search(r"CPF\/CNPJ:\s*([\d\./-]+)", texto)
        if cpf_cnpj:
            doc = cpf_cnpj.group(1).replace(".", "").replace("-", "").replace("/", "")
            dados["cpf_cnpj"] = doc
            dados["tipo_documento"] = "CNPJ" if len(doc) == 14 else "CPF"

        taxa_adm = re.search(r"Taxa Adm:\s*([\d.,]+)", texto)
        if taxa_adm:
            taxa_valor = float(taxa_adm.group(1).replace(",", "."))
            dados["taxa_adm_percentual"] = taxa_valor
            aprendizado_campo["taxa_adm_percentual"] = {"valor": taxa_valor, "layout_detectado": "regex"}

        try:
            adesao_match = re.search(
                r"(?:Ades[aã]o(?:\s*[-:]|\s+))\s*R?\$?\s*([\d\.]+,\d{2})",
                texto,
                re.IGNORECASE
            )
            if adesao_match:
                valor = adesao_match.group(1).replace(".", "").replace(",", ".")
                dados["adesao"] = round(float(valor), 2)
            else:
                dados["adesao"] = 0.0
        except Exception as e:
            print(f"[!] Erro ao extrair valor da adesão: {e}")
            dados["adesao"] = 0.0

        parcelas_plano = re.search(r"Plano Básico:\s*(\d+)", texto)
        if parcelas_plano:
            dados["total_parcelas_plano"] = int(parcelas_plano.group(1))
        
        valor_credito_match = re.search(r"Valor Crédito:\s*([\d\.]+,\d{2})", texto)
        if valor_credito_match:
            valor = valor_credito_match.group(1).replace(".", "").replace(",", ".")
            dados["valor_credito"] = round(float(valor), 2)

        encerramento = re.search(
            r"(Data prevista para o encerramento do grupo|Data de encerramento|Encerramento previsto)[\s:]*([\d]{2}/[\d]{2}/[\d]{4})",
            texto,
            re.IGNORECASE
        )
        if encerramento:
            dados["data_encerramento"] = encerramento.group(2)
        else:
            primeira_assembleia = re.search(
                r"(?:\b(?:1ª|1a|1|primeira)\s+assembleia.*?)(\d{2}/\d{2}/\d{4})",
                texto,
                re.IGNORECASE
            )
            if primeira_assembleia and "total_parcelas_plano" in dados:
                data_dt = datetime.strptime(primeira_assembleia.group(1), "%d/%m/%Y")
                meses = dados["total_parcelas_plano"]
                data_final = data_dt + relativedelta(months=meses - 1)
                dados["data_encerramento"] = data_final.strftime("%d/%m/%Y")

        valor_pago_totais = re.search(r"TOTAIS\s+\d[\d\.,]+\s+([\d\.,]+)\s", texto)
        if valor_pago_totais:
            valor_txt = valor_pago_totais.group(1).replace(".", "").replace(",", ".")
            dados["valor_total_pago_extrato"] = round(float(valor_txt), 2)
        else:
            valor_pago_alt = re.search(r"Valores\s*/\s*Percentuais\s*Pagos[\s\S]*?TOTAL\s*([\d\s.,]+)", texto, re.IGNORECASE)
            if valor_pago_alt:
                valor_txt = re.sub(r"[^\d,\.]", "", valor_pago_alt.group(1)).replace(",", ".")
                dados["valor_total_pago_extrato"] = round(float(valor_txt), 2)

        try:
            linhas_taxa = [linha for linha in texto.splitlines() if "administração" in linha.lower()]
            print("\n🔍 Linhas contendo 'administração':")
            for linha in linhas_taxa:
                print(f">>> {linha}")
        except Exception as e:
            print(f"❌ Erro ao procurar linhas com 'administração': {e}")

        try:
            taxa_adm_valor_match = re.search(
                r"Taxa de Administração:\s*([\d.,]+)",
                texto,
                flags=re.IGNORECASE
            )
            if taxa_adm_valor_match:
                valor_bruto = taxa_adm_valor_match.group(1)
                valor_normalizado = valor_bruto.replace(".", "").replace(",", ".")
                valor_float = round(float(valor_normalizado), 2)
                dados["valor_total_taxa_adm_cobrada"] = valor_float
                dados["taxa_adm_cobrada_valor"] = valor_float
            else:
                dados["valor_total_taxa_adm_cobrada"] = None
                dados["taxa_adm_cobrada_valor"] = None
        except Exception as e:
            print(f"❌ Erro ao extrair valor da taxa de administração: {e}")
            dados["valor_total_taxa_adm_cobrada"] = None
            dados["taxa_adm_cobrada_valor"] = None

        cidade_match = re.search(r"Cidade:\s*(.*?)\s+UF:", texto)
        uf_match = re.search(r"UF:\s*([A-Z]{2})", texto)

        cidade = cidade_match.group(1).strip() if cidade_match else ""
        estado = uf_match.group(1).strip() if uf_match else ""

        cep_match = re.search(r"\b\d{8}\b|\b\d{5}-\d{3}\b", texto)
        if cep_match:
            cep = cep_match.group().replace("-", "")
            dados["cep"] = cep

            if not cidade or not estado:
                cidade, estado = buscar_cidade_estado_por_cep(cep)

            dados["cidade"] = cidade
            dados["estado"] = estado
        else:
            dados["cep"] = ""
            dados["cidade"] = cidade
            dados["estado"] = estado

        numero_contrato_match = re.search(r"Contrato[:\s]*([0-9]{6,20})", texto, re.IGNORECASE)
        dados["numero_contrato"] = numero_contrato_match.group(1).strip() if numero_contrato_match else ""

        try:
            campos_valores = {
                "fundo_comum": r"Fundo Comum:\s*([\d\.,]+)",
                "fundo_reserva": r"Fundo de Reserva:\s*([\d\.,]+)",
                "seguros": r"Seguros:\s*([\d\.,]+)",
                "multas": r"Multas:\s*([\d\.,]+)",
                "juros": r"Juros:\s*([\d\.,]+)",
                "adesao": r"Ades[aã]o:\s*([\d\.,]+)",
                "outros_valores": r"Outros Valores:\s*([\d\.,]+)",
            }

            for campo, padrao in campos_valores.items():
                match = re.search(padrao, texto, flags=re.IGNORECASE)
                if match:
                    valor = float(match.group(1).replace(".", "").replace(",", "."))
                    dados[campo] = round(valor, 2)
                else:
                    dados[campo] = 0.0
        except Exception as e:
            print(f"❌ Erro ao extrair valores adicionais: {e}")

    except Exception as e:
        print(f"❌ Erro ao extrair informações básicas: {e}")

    parcelas = extrair_parcelas_conta_corrente(texto)

    usou_ia = False
    if not parcelas:
        print("⚠️ Nenhuma parcela encontrada em Conta Corrente. Tentando IA...")
        try:
            imagens = converter_pdf_para_imagens(caminho_pdf)
            for img_path in imagens:
                try:
                    parcelas_ia = ler_extrato_com_ia(img_path)
                    if parcelas_ia:
                        parcelas.extend(parcelas_ia)
                        usou_ia = True
                except Exception as e_ia:
                    print(f"❌ Erro IA ({img_path}): {e_ia}")
        except Exception as e:
            print(f"❌ Erro ao converter PDF para imagem para IA: {e}")

    if not dados.get("administradora"):
        dados["administradora"] = extrair_administradora_primeira_pagina(caminho_pdf)

    # NOVO: Se a administradora foi extraída mas o CNPJ ainda está vazio, tentar buscar via JSON
    if not dados.get("cnpj_administradora") and dados.get("administradora"):
        nome = dados["administradora"].upper().strip()
        correspondencias = get_close_matches(nome, administradoras_conhecidas, n=1, cutoff=0.6)
        if correspondencias:
            nome_correspondente = correspondencias[0]
            cnpj = mapa_administradoras.get(nome_correspondente)
            if cnpj:
                dados["cnpj_administradora"] = cnpj
                print(f"🧩 CNPJ encontrado via nome: {nome_correspondente} → {cnpj}")
        else:
            print(f"⚠️ Nenhuma correspondência de nome encontrada para: {nome}")

    aprendizado = ler_aprendizado(dados.get("administradora", "DESCONHECIDA"))
    salvar_aprendizado(
        administradora=dados.get("administradora", "DESCONHECIDA"),
        sucesso=True if parcelas else False,
        usou_ia=usou_ia,
        data_encerramento_via="vinda_do_campo" if dados.get("data_encerramento") else "calculada_pela_primeira_assembleia",
        campos_aprendidos=aprendizado_campo
    )

    return dados, parcelas