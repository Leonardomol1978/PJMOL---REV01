import requests

def enviar_para_assinatura(nome_cliente, telefone_cliente, url_documento, nome_documento, api_key):
    try:
        payload = {
            "name": nome_documento,
            "external_id": "pjmol-" + nome_cliente.lower().replace(" ", "_"),
            "sandbox": False,
            "external_document_url": url_documento,
            "send_automatic_whatsapp": True,
            "signers": [
                {
                    "name": nome_cliente,
                    "phone_country": "55",
                    "phone_number": telefone_cliente.replace("+55", "").replace(" ", "").replace("-", ""),
                    "auth_mode": "link"
                }
            ]
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Token {api_key}"
        }

        url = "https://api.zapsign.com.br/api/v1/documents/"

        print("\n📤 Enviando documento para ZapSign...")
        print("🔗 URL:", url)
        print("🧾 Payload:", payload)
        print("🔐 API Key:", api_key[:5] + "..." + api_key[-4:])

        response = requests.post(url, json=payload, headers=headers)

        print("📥 Resposta Status:", response.status_code)
        print("📥 Resposta Body:", response.text)

        if response.status_code not in [200, 201]:
            raise Exception(f"Erro ao enviar para ZapSign: {response.status_code} - {response.text}")

        return response.json()

    except Exception as e:
        print("❌ Erro na integração com ZapSign:", e)
        raise e
