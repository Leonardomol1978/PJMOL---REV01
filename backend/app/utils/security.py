from passlib.context import CryptContext

# Define o contexto de criptografia com bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Gera o hash da senha usando o contexto definido
def gerar_hash_senha(senha: str) -> str:
    return pwd_context.hash(senha)

# Verifica se a senha fornecida bate com o hash armazenado
def verificar_senha(senha: str, senha_hash: str) -> bool:
    return pwd_context.verify(senha, senha_hash)
