from app.database import Base, engine
from app import models  # <--- Importante

print("🏗️ Criando tabelas...")
Base.metadata.create_all(bind=engine)
print("✅ Tabelas criadas com sucesso!")
