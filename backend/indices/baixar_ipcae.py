import requests
import pandas as pd
import os
from datetime import datetime
from io import StringIO

# Caminho absoluto até a pasta onde este script está
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Caminho correto para salvar o arquivo (relativo ao backend)
DIRETORIO_SAIDA = os.path.normpath(os.path.join(BASE_DIR, "..", "indices", "tabelas", "ipcae"))
ARQUIVO_SAIDA = "ipcae_historico.csv"
URL_IPCAE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=csv"

# Cria o diretório, se necessário
os.makedirs(DIRETORIO_SAIDA, exist_ok=True)

# Baixa os dados
print("📥 Baixando dados do IPCA-E do Banco Central...")
resposta = requests.get(URL_IPCAE)
resposta.encoding = 'utf-8'

if resposta.status_code != 200:
    raise Exception(f"Erro ao baixar IPCA-E: {resposta.status_code}")

# Lê CSV da resposta
df = pd.read_csv(StringIO(resposta.text), sep=';', encoding='utf-8')

# Renomeia colunas
if 'data' in df.columns and 'valor' in df.columns:
    df.columns = ['DATA', 'IPCAE']
else:
    raise Exception("Formato inesperado na resposta da API do Bacen.")

# Converte datas
df['DATA'] = pd.to_datetime(df['DATA'], format='%d/%m/%Y')
df['ANO'] = df['DATA'].dt.year
df['MES'] = df['DATA'].dt.month_name(locale='pt_BR').str.capitalize()

# Converte índice
df['IPCAE'] = df['IPCAE'].astype(str).str.replace(',', '.').astype(float)

# Organiza colunas
df_final = df[['ANO', 'MES', 'IPCAE']]

# Salva arquivo
caminho_final = os.path.join(DIRETORIO_SAIDA, ARQUIVO_SAIDA)
df_final.to_csv(caminho_final, index=False, encoding='utf-8')

print(f"✅ IPCA-E salvo em: {caminho_final}")
