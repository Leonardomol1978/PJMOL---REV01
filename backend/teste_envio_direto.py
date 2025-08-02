import requests
from app.google_drive_uploader import upload_pdf_to_drive

# 📌 Caminho local do PDF
CAMINHO_PDF = "/Users/leonardomol/Jao/PJMOL 25-07-2025/backend/documentos_gerados/procuracao_joao_20250730165249.pdf"

# 📌 Sua chave da ZapSign
API_KEY = "3fb8d0b6-cb8a-4362-87b1-93ee51c9e5079c159f10-2047-49ed-a459-e978082f9108"  # 🔁 substitua por sua chave real

# 📌 Dados do signatário
NOME_SIGNATARIO = "João da Silva"
DDD = "31"
NUMERO = "999999999"  # sem o DDD

# 📌 Enviar em sandbox?
SANDBOX = False

# 🔄 1. Upload para Google Drive
print("🔼 Subindo o arquivo para o Google Drive...")
try:
    public_url = upload_pdf_to_drive(CAMINHO_PDF)
    print(f"✅ Link público do PDF:\n{public_url}")
except Exception as e:
    print(f"❌ Erro ao subir para o Google Drive: {e}")
    exit()

# 📤 2. Envio para a ZapSign com link público
print("📤 Enviando para ZapSign com o link público...")
payload = {
    "name": "Procuração PJMOL",
    "external_id": "procuracao-teste-via-drive-001",
    "external_document_url": public_url,
    "lang": "pt-br",
    "sandbox": SANDBOX,
    "send_automatic_whatsapp": True,
    "signers": [
        {
            "name": NOME_SIGNATARIO,
            "phone_country": "55",
            "phone_number": f"{DDD}{NUMERO}",
            "auth_mode": "link"
        }
    ]
}

headers = {
    "Authorization": f"Token {API_KEY}",
    "Content-Type": "application/json"
}

try:
    response = requests.post(
        "https://api.zapsign.com.br/api/v1/documents/",
        json=payload,
        headers=headers
    )
    print(f"📡 Status da requisição: {response.status_code}")
    print("📦 Resposta da ZapSign:")

    try:
        print(response.json())
    except Exception:
        print("⚠️ Resposta não é JSON:")
        print(response.text)

except Exception as e:
    print(f"❌ Erro inesperado: {e}")
