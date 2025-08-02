# backend/verificar_taxa_adm.py

import os
from app.extracao.leitura_pdf import extrair_dados_pdf

def main():
    print("📂 Digite o caminho do PDF do extrato:")
    caminho_pdf = input(">>> ").strip()

    if not os.path.exists(caminho_pdf):
        print(f"❌ Arquivo não encontrado: {caminho_pdf}")
        return

    print(f"🔍 Processando: {caminho_pdf}")
    dados, _ = extrair_dados_pdf(caminho_pdf)

    print("\n📦 DADOS EXTRAÍDOS:")
    for chave in ["grupo", "cota", "nome_cliente", "administradora",
                  "valor_total_taxa_adm_cobrada", "taxa_adm_cobrada_valor"]:
        print(f"{chave}: {dados.get(chave)}")

    valor_taxa = dados.get("valor_total_taxa_adm_cobrada")
    if valor_taxa is None:
        print("⚠️ Valor da taxa de administração (R$) não foi extraído corretamente.")
    else:
        print(f"✅ Valor absoluto da taxa de administração: R$ {valor_taxa:.2f}")

if __name__ == "__main__":
    main()
