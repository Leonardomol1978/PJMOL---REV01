from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# Caminho para o banco de dados SQLite relativo à raiz do projeto
DATABASE_URL = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'database.db')}"  # Usando o caminho relativo à pasta onde o script está localizado

# Cria o engine do SQLAlchemy
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

# Cria uma sessão local vinculada ao engine
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base para os modelos ORM
Base = declarative_base()

# Função para criar as tabelas no banco de dados
def create_tables():
    Base.metadata.create_all(bind=engine)  # Cria as tabelas baseadas no modelo do SQLAlchemy

# Função que fornece a sessão do banco para uso com FastAPI (via Depends)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
