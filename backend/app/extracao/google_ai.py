import os
import google.generativeai as genai
from PIL import Image
import json

# Configure sua chave de API
genai.configure(api_key=os.getenv("AIzaSyDTe03csjBZIRa2Kjghp7Um53oasETEF3Q", "AIzaSyDTe03csjBZIRa2Kjghp7Um53oasETEF3Q"))

# Carrega o modelo Gemini
model = genai.GenerativeModel("gemini-1.5-pro")

# Função para ler parcelas a partir de imagem usando IA
def ler_extrato_com_ia(caminho_imagem):
    try:
        imagem = Image.open(caminho_imagem)

        prompt = """
        Leia este extrato de consórcio. Retorne um JSON com as parcelas pagas.
        Ignore parcelas a vencer, valores pendentes e lançamentos futuros.
        Considere como parcela paga qualquer valor quitado (independente de ser parcela regular ou ajuste).
        Use o seguinte formato JSON padrão:
        [
            {"data_pagamento": "dd/mm/aaaa", "valor_pago": 9999.99},
            ...
        ]
        Não inclua cabeçalho, não inclua campos adicionais.
        Não use explicações, retorne apenas o JSON da lista de parcelas.
        """

        response = model.generate_content([prompt, imagem])
        texto_json = response.text.strip()

        print(f"\n📩 Resposta do Gemini para {caminho_imagem}:\n{texto_json}\n")

        # Corrige blocos de markdown e aspas
        if texto_json.startswith("```json"):
            texto_json = texto_json.replace("```json", "").replace("```", "").strip()

        texto_json = texto_json.replace("'", '"')

        parcelas = json.loads(texto_json)

        if isinstance(parcelas, list):
            return parcelas
        else:
            print("⚠️ Resposta da IA não está em formato de lista.")
            return []

    except Exception as e:
        print("❌ Erro ao consultar o Gemini:")
        print(e)
        return []
