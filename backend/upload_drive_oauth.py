import os
import pickle
import mimetypes
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ['https://www.googleapis.com/auth/drive.file']

def autenticar():
    creds = None
    if os.path.exists('token_drive.pkl'):
        with open('token_drive.pkl', 'rb') as token:
            creds = pickle.load(token)
    else:
        flow = InstalledAppFlow.from_client_secrets_file(
            'client_secret_762120776458-v43a5skoijg1t0mg5mjq7moorkheki10.apps.googleusercontent.com.json', SCOPES)
        creds = flow.run_local_server(port=0)
        with open('token_drive.pkl', 'wb') as token:
            pickle.dump(creds, token)
    return creds

def upload_arquivo(arquivo_path):
    creds = autenticar()
    service = build('drive', 'v3', credentials=creds)

    nome_arquivo = os.path.basename(arquivo_path)
    mime_type = mimetypes.guess_type(arquivo_path)[0] or 'application/octet-stream'

    file_metadata = {'name': nome_arquivo}
    media = MediaFileUpload(arquivo_path, mimetype=mime_type)
    arquivo = service.files().create(body=file_metadata, media_body=media, fields='id, webViewLink').execute()
    print(f"✅ Arquivo enviado com sucesso!")
    print(f"🔗 Link: {arquivo.get('webViewLink')}")

if __name__ == '__main__':
    caminho_pdf = 'documentos_gerados/procuracao_leonardo_homsi_garcia_20250729194927.pdf'
    upload_arquivo(caminho_pdf)
