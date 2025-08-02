from app.database import create_tables
from app.models import advogado  # Garante que o modelo seja carregado

if __name__ == "__main__":
    create_tables()