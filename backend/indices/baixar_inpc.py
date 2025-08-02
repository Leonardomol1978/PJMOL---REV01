import requests
import pandas as pd
import os
from datetime import datetime
from io import StringIO  # Leitura do CSV direto da resposta

# Diretório de saída absoluto baseado no local deste script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIRETORIO_SAIDA = os.path.normpath(os.path.join(BASE_DIR, "tabelas", "inpc"))
ARQUIVO_SAIDA = "inpc_historico.csv"
URL_INPC = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.188/dados?formato=csv"  # Série 188 = INPC

# Cria o diretório se não existir
os.makedirs(DIRETORIO_SAIDA, exist_ok=True)

# Baixa os dados da API do Bacen
print("📥 Baixando dados do INPC do Banco Central...")
resposta = requests.get(URL_INPC)
resposta.encoding = 'utf-8'

if resposta.status_code != 200:
    raise Exception(f"Erro ao baixar INPC: {resposta.status_code}")

# Lê CSV direto da resposta
df = pd.read_csv(StringIO(resposta.text), sep=';', encoding='utf-8')

# Renomeia colunas
if 'data' in df.columns and 'valor' in df.columns:
    df.columns = ['DATA', 'INPC']
else:
    raise Exception("Formato inesperado na resposta da API do Bacen.")

# Converte data e extrai mês e ano
df['DATA'] = pd.to_datetime(df['DATA'], format='%d/%m/%Y')
df['ANO'] = df['DATA'].dt.year
df['MES'] = df['DATA'].dt.month_name(locale='pt_BR').str.capitalize()

# Converte INPC para float
df['INPC'] = df['INPC'].astype(str).str.replace(',', '.').astype(float)

# Seleciona e reordena colunas
df_final = df[['ANO', 'MES', 'INPC']]

# Caminho final para salvar o arquivo
caminho_final = os.path.join(DIRETORIO_SAIDA, ARQUIVO_SAIDA)
df_final.to_csv(caminho_final, index=False, encoding='utf-8')

print(f"✅ INPC salvo em {caminho_final}")
