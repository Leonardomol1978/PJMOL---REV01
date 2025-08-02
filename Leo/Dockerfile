FROM python:3.10-slim

# Instala dependências do sistema
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsm6 \
    libxext6 \
    libasound2-dev \
    libpulse-dev \
    libsdl2-mixer-2.0-0 \
    libsdl2-ttf-2.0-0 \
    libsdl2-image-2.0-0 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Cria diretório da aplicação
WORKDIR /app

# Copia arquivos
COPY . /app

# Instala dependências Python
RUN pip install --no-cache-dir -r requirements.txt

# Comando para iniciar a aplicação
CMD ["uvicorn", "app.main:app", "--host=0.0.0.0", "--port=10000"]
