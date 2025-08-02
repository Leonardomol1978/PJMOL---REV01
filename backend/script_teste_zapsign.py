import requests

# 🔧 Substitua pelos seus dados reais
API_KEY_ZAPSIGN = "435b18ea-af6f-4f53-8f24-fcf8cc3c94b9870b2d05-ac33-44a9-b35d-a9ddfc39c608"  # sem "Token "
NOME_CLIENTE = "LEONARDO DE FREITAS MOL"
TELEFONE_CLIENTE = "31998640571"
NOME_DOCUMENTO = "Procuração PJMOL"
URL_DOCUMENTO = "https://drive.google.com/uc?export=download&id=1tItXDnBknBoKPiJePr6VqCFOUUiMnIm1"  # ⚠️ link direto gerado no upload

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_KEY_ZAPSIGN}"
}

payload = {
    "name": NOME_DOCUMENTO,
    "sandbox": False,  # ✅ PROD. Coloque True para ambiente de teste
    "external_id": f"{NOME_CLIENTE}-{NOME_DOCUMENTO}",
    "url_pdf": URL_DOCUMENTO,
    "send_automatic_whatsapp": True,  # ✅ ENVIA VIA WHATSAPP
    "signers": [
        {
            "name": NOME_CLIENTE,
            "phone_country": "55",
            "phone_number": TELEFONE_CLIENTE,
            "auth_mode": "link"
        }
    ]
}

print("➡️ Enviando para ZapSign:")
print(payload)

response = requests.post("https://api.zapsign.com.br/api/v1/docs", headers=headers, json=payload)

print("📥 Resposta:")
print("Status:", response.status_code)
print("Body:", response.text)

if response.status_code != 200:
    raise Exception("❌ Erro ao enviar para ZapSign.")
