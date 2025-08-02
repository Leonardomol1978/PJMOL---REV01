import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Caminho absoluto para o banco de dados SQLite
DATABASE_URL = f"sqlite:///{os.path.join(os.getcwd(), 'backend', 'database.db')}"

# Criação do engine
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Sessão local para uso no FastAPI
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base para os modelos
Base = declarative_base()

# Dependência para injeção no FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
