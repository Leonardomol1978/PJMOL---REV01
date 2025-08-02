import os
import google.generativeai as genai
from PIL import Image
import json

# Configure sua chave de API aqui ou por variável de ambiente
genai.configure(api_key=os.getenv("AIzaSyDTe03csjBZIRa2Kjghp7Um53oasETEF3Q", "AIzaSyDTe03csjBZIRa2Kjghp7Um53oasETEF3Q"))

# Carrega o modelo Gemini
model = genai.GenerativeModel("gemini-1.5-flash")

# Função para ler parcelas a partir de imagem usando IA
def ler_extrato_com_ia(caminho_imagem):
    try:
        imagem = Image.open(caminho_imagem)

        prompt = (
            "Leia este extrato de consórcio e retorne um JSON com as parcelas pagas. "
            "Para cada parcela, informe a data de pagamento e o valor total pago. "
            "Formato esperado: [{'data_pagamento': '10/01/2024', 'valor_pago': 1250.75}, {...}]"
        )

        response = model.generate_content([prompt, imagem])
        texto_json = response.text.strip()

        print(f"\n📩 Resposta do Gemini para {caminho_imagem}:\n{texto_json}\n")

        # Remove blocos de markdown e corrige aspas
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
