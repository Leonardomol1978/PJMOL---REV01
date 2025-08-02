# Etapa 1: construir o app
FROM node:18 AS builder
WORKDIR /app

# Instala dependências
COPY package*.json ./
RUN npm install

# Copia o restante dos arquivos e constrói o app
COPY . .
RUN npm run build

# Etapa 2: serve com Next.js
FROM node:18
WORKDIR /app

COPY --from=builder /app ./

EXPOSE 3000

# Usa o servidor Next.js para produção
CMD ["npm", "start"]
