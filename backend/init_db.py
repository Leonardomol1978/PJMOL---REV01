from app.database import engine  # Importa o engine que conecta ao banco de dados
from app.models import Base  # Base é onde os modelos são definidos

# Função que cria as tabelas no banco de dados
def init_db():
    print("🏗️ Criando tabelas no banco de dados...")
    Base.metadata.create_all(bind=engine)  # Cria todas as tabelas baseadas nos modelos
    print("✅ Banco de dados e tabelas criados com sucesso.")

# Executando a função de criação das tabelas
if __name__ == "__main__":
    init_db()
