import os
import sys
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS # Importar CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv

load_dotenv() # Carrega variáveis do .env

from src.database import db # Importa db de database.py

# Importar Blueprints
from src.routes.auth import auth_bp, token_required
from src.routes.domain import domain_bp
from src.routes.logs import logs_bp
from src.routes.verify import verify_bp
from src.routes.admin import admin_bp

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'default_secret_key') # Carregar do .env

# Configurar CORS para permitir todas as origens (ajustar para produção)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Configuração do Banco de Dados (descomentado e usando .env)
app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+pymysql://{os.getenv('DB_USERNAME', 'root')}:{os.getenv('DB_PASSWORD', 'password')}@{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '3306')}/{os.getenv('DB_NAME', 'mydb')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app) # Inicializa o db importado com o app

# Configuração do Rate Limiter
limiter = Limiter(
    get_remote_address, # Usa o IP do cliente como chave
    app=app,
    default_limits=["200 per day", "50 per hour"], # Limites padrão para todas as rotas
    storage_uri="memory://",  # Usa memória para armazenamento (para produção, considere Redis)
    strategy="fixed-window" # Estratégia de janela fixa
)

# Aplicar limites específicos a blueprints ou rotas
# Exemplo: Limitar mais estritamente o endpoint de verificação
limiter.limit("100 per minute")(verify_bp)
# Exemplo: Limitar endpoints de autenticação
limiter.limit("10 per minute")(auth_bp)

# Registrar Blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(domain_bp, url_prefix='/api') # Rotas como /api/domains
app.register_blueprint(logs_bp, url_prefix='/api') # Rotas como /api/logs
app.register_blueprint(verify_bp, url_prefix='/api') # Rotas como /api/verify
app.register_blueprint(admin_bp, url_prefix='/api/admin') # Rotas como /api/admin/users

# Endpoint para servir o script pixel.js minificado
@app.route('/api/pixel.js')
@limiter.exempt # Isentar este endpoint do rate limiting global, se necessário
def serve_pixel():
    # Servir a versão minificada
    pixel_path = os.path.join(app.static_folder, 'pixel.min.js')
    if os.path.exists(pixel_path):
        return send_from_directory(app.static_folder, 'pixel.min.js', mimetype='application/javascript')
    else:
        # Fallback para a versão não minificada se a minificada não existir
        pixel_path_unminified = os.path.join(app.static_folder, 'pixel.js')
        if os.path.exists(pixel_path_unminified):
            return send_from_directory(app.static_folder, 'pixel.js', mimetype='application/javascript')
        else:
            return jsonify({"error": "Pixel script not found"}), 404
# Endpoint de teste para verificar se o app está rodando
@app.route("/api/ping")
@limiter.limit("5 per minute") # Limite específico para esta rota
def ping():
    return jsonify({"message": "pong"})

# Endpoint de teste para rota protegida
@app.route('/api/protected')
@token_required
def protected_route(current_user):
    return jsonify({"message": f"Hello user {current_user.email}! This is a protected route."})

# Criar tabelas (se não existirem) - Mover para um comando de CLI ou script de inicialização depois
# with app.app_context():
#     db.create_all()

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
            return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

