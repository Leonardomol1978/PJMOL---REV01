from PIL import Image
import pytesseract

def fazer_ocr_google(imagem_path):
    try:
        img = Image.open(imagem_path)
        return pytesseract.image_to_string(img, lang="por")
    except Exception as e:
        print(f"❌ Erro OCR: {e}")
        return ""
