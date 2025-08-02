import os
import json
from datetime import datetime

PASTA_APRENDIZADO = "app/aprendizado/dados"
os.makedirs(PASTA_APRENDIZADO, exist_ok=True)

def ler_aprendizado(administradora: str):
    caminho = os.path.join(PASTA_APRENDIZADO, f"{administradora}.json")
    if not os.path.exists(caminho):
        return {}
    try:
        with open(caminho, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Erro ao ler aprendizado: {e}")
        return {}

def salvar_aprendizado(administradora: str, sucesso: bool, usou_ia: bool, data_encerramento_via: str, campos_aprendidos: dict = {}):
    caminho = os.path.join(PASTA_APRENDIZADO, f"{administradora}.json")

    aprendizado = ler_aprendizado(administradora)

    # Inicializa se vazio
    if not aprendizado:
        aprendizado = {
            "total_processados": 0,
            "com_sucesso": 0,
            "falha": 0,
            "usou_ia": 0,
            "ultimos_5": [],
            "campos_aprendidos": {}
        }

    aprendizado["total_processados"] += 1
    if sucesso:
        aprendizado["com_sucesso"] += 1
    else:
        aprendizado["falha"] += 1
    if usou_ia:
        aprendizado["usou_ia"] += 1

    # Atualiza ultimos 5 runs
    aprendizado["ultimos_5"].append({
        "sucesso": sucesso,
        "usou_ia": usou_ia,
        "data_encerramento_via": data_encerramento_via,
        "timestamp": datetime.utcnow().isoformat()
    })
    aprendizado["ultimos_5"] = aprendizado["ultimos_5"][-5:]

    # Grava campos aprendidos, se informados
    for campo, valor in campos_aprendidos.items():
        if valor:
            aprendizado["campos_aprendidos"][campo] = valor

    try:
        with open(caminho, "w", encoding="utf-8") as f:
            json.dump(aprendizado, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"❌ Erro ao salvar aprendizado: {e}")
