import os
import pickle
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.auth.transport.requests import Request

# Escopo necessário para upload e compartilhamento
SCOPES = ['https://www.googleapis.com/auth/drive.file']

# Caminho dos arquivos de autenticação
CREDENTIALS_PATH = os.path.join(os.getcwd(), "client_secret_762120776458-v43a5skoijg1t0mg5mjq7moorkheki10.apps.googleusercontent.com.json")
TOKEN_PATH = os.path.join(os.getcwd(), "token_drive_oauth.pickle")

def autenticar_drive():
    creds = None

    # Usa o token salvo se disponível
    if os.path.exists(TOKEN_PATH):
        with open(TOKEN_PATH, 'rb') as token:
            creds = pickle.load(token)

    # Se não há token válido, inicia o fluxo OAuth
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_PATH, 'wb') as token:
            pickle.dump(creds, token)

    return build('drive', 'v3', credentials=creds)

def upload_pdf_to_drive(caminho_pdf: str, nome_arquivo: str) -> str:
    try:
        service = autenticar_drive()

        # Define os metadados
        file_metadata = {'name': nome_arquivo, 'mimeType': 'application/pdf'}
        media = MediaFileUpload(caminho_pdf, mimetype='application/pdf')

        # Faz upload
        file = service.files().create(body=file_metadata, media_body=media, fields='id').execute()
        file_id = file.get('id')

        # Define o arquivo como público
        service.permissions().create(
            fileId=file_id,
            body={'type': 'anyone', 'role': 'reader'}
        ).execute()

        # ✅ Link direto de download compatível com ZapSign
        return f"https://drive.google.com/uc?export=download&id={file_id}"

    except Exception as e:
        raise RuntimeError(f"Erro ao fazer upload para o Google Drive: {e}")
