import os
import time
import requests
import pandas as pd
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

# URL e pastas
URL_TJMG = "https://www.tjmg.jus.br/portal-tjmg/processos/indicadores/fator-de-atualizacao-monetaria.htm"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PASTA_SAIDA = os.path.join(BASE_DIR, "tabelas", "tjmg")
os.makedirs(PASTA_SAIDA, exist_ok=True)

def baixar_tabela_mg():
    print("🚀 Acessando página do TJMG com Selenium...")

    options = Options()
    options.add_argument('--headless')
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    service = Service(ChromeDriverManager().install())

    with webdriver.Chrome(service=service, options=options) as driver:
        driver.get(URL_TJMG)
        time.sleep(4)
        soup = BeautifulSoup(driver.page_source, "html.parser")
        links = soup.find_all("a", href=True)

        excel_links = []
        for tag in links:
            href = tag["href"]
            if "fileDownload.jsp?fileId=" in href:
                url_completa = "https://www.tjmg.jus.br" + href.replace("..", "")
                try:
                    head = requests.head(url_completa, timeout=10)
                    content_type = head.headers.get("Content-Type", "")
                    if "spreadsheetml" in content_type or "excel" in content_type:
                        excel_links.append(url_completa)
                except Exception:
                    continue

        if not excel_links:
            print("❌ Nenhum arquivo Excel real encontrado.")
            return

        link_mais_recente = excel_links[0]
        print(f"📥 Baixando: {link_mais_recente}")

        try:
            r = requests.get(link_mais_recente)
            r.raise_for_status()
            caminho_temporario = os.path.join(PASTA_SAIDA, "temporario.xlsx")

            with open(caminho_temporario, "wb") as f:
                f.write(r.content)
            print(f"✅ Arquivo baixado: {caminho_temporario}")

            df = pd.read_excel(caminho_temporario, engine="openpyxl")

            # Detectar início da tabela real
            for i, row in df.iterrows():
                if str(row[0]).strip().upper() == "ANO":
                    df_dados = df.iloc[i + 1:].copy()
                    df_dados.columns = ["ANO", "MES", "INDICE"]
                    break
            else:
                raise ValueError("❌ Cabeçalho 'ANO, MÊS, ÍNDICE' não encontrado no arquivo.")

            df_dados = df_dados.dropna().copy()
            df_dados["MES"] = df_dados["MES"].astype(str).str.strip().str.capitalize()

            # Salvar como único arquivo padrão
            caminho_csv = os.path.join(PASTA_SAIDA, "tjmg_historico.csv")
            df_dados.to_csv(caminho_csv, index=False)
            os.remove(caminho_temporario)

            print(f"✅ Tabela TJMG salva como: {caminho_csv}")

        except Exception as e:
            print(f"❌ Erro ao processar o arquivo: {e}")

if __name__ == "__main__":
    baixar_tabela_mg()
