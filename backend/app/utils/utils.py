import subprocess
import sys
import re
from dateutil import parser
from datetime import datetime, date

def instalar_dependencias():
    pacotes = [
        "pandas",
        "pdfplumber",
        "PyMuPDF",
        "pdf2image",
        "pytesseract",
        "Pillow",
        "google-generativeai",
    ]
    for pacote in pacotes:
        try:
            print(f"🔧 Instalando pacote: {pacote} ...")
            subprocess.run([sys.executable, "-m", "pip", "install", pacote], check=True)
        except subprocess.CalledProcessError:
            print(f"❌ Falha ao instalar {pacote}. Tente instalar manualmente.")

def limpar_texto(texto):
    """
    Limpa o texto removendo quebras de linha e espaços repetidos.
    """
    texto = texto.replace("\r", " ").replace("\n", " ")
    texto = re.sub(r"\s{2,}", " ", texto)
    return texto.strip()

def normalizar_data(data_entrada):
    """
    Converte string ou datetime em objeto date.
    """
    if isinstance(data_entrada, str):
        try:
            return parser.parse(data_entrada).date()
        except Exception as e:
            raise ValueError(f"Erro ao converter data: {data_entrada} ({e})")
    elif isinstance(data_entrada, datetime):
        return data_entrada.date()
    elif isinstance(data_entrada, date):
        return data_entrada
    else:
        raise ValueError(f"Tipo de data inválido: {type(data_entrada)}")
