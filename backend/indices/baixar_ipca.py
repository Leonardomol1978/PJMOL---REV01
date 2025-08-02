import requests
import pandas as pd
import os
from datetime import datetime
from io import StringIO

# Diretório base (relativo ao local deste script)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIRETORIO_SAIDA = os.path.normpath(os.path.join(BASE_DIR, "tabelas", "ipca"))
ARQUIVO_SAIDA = "ipca_historico.csv"
URL_IPCA = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=csv"

# Cria o diretório se não existir
os.makedirs(DIRETORIO_SAIDA, exist_ok=True)

# Baixa os dados da API do Bacen
print("📥 Baixando dados do IPCA do Banco Central...")
resposta = requests.get(URL_IPCA)
resposta.encoding = 'utf-8'

if resposta.status_code != 200:
    raise Exception(f"Erro ao baixar IPCA: {resposta.status_code}")

# Lê CSV direto da resposta
df = pd.read_csv(StringIO(resposta.text), sep=';', encoding='utf-8')

# Renomeia colunas
if 'data' in df.columns and 'valor' in df.columns:
    df.columns = ['DATA', 'IPCA']
else:
    raise Exception("Formato inesperado na resposta da API do Bacen.")

# Converte data e extrai ano/mês
df['DATA'] = pd.to_datetime(df['DATA'], format='%d/%m/%Y')
df['ANO'] = df['DATA'].dt.year
df['MES'] = df['DATA'].dt.month_name(locale='pt_BR').str.capitalize()

# Converte IPCA para float
df['IPCA'] = df['IPCA'].astype(str).str.replace(',', '.').astype(float)

# Seleciona colunas finais
df_final = df[['ANO', 'MES', 'IPCA']]

# Caminho final para salvar
caminho_final = os.path.join(DIRETORIO_SAIDA, ARQUIVO_SAIDA)
df_final.to_csv(caminho_final, index=False, encoding='utf-8')

print(f"✅ IPCA salvo em {caminho_final}")
