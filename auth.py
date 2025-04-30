# src/routes/auth.py

import os
import jwt
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from src.database import db
from src.models.user import User
from src.models.refresh_token import RefreshToken

auth_bp = Blueprint("auth", __name__)

# Helper function to generate tokens
def _generate_tokens(user_id):
    access_token_payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15) # Short-lived access token (15 mins)
    }
    refresh_token_payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30) # Longer-lived refresh token (30 days)
    }
    secret_key = os.getenv("JWT_SECRET_KEY", "default_jwt_secret")
    
    access_token = jwt.encode(access_token_payload, secret_key, algorithm="HS256")
    refresh_token_str = jwt.encode(refresh_token_payload, secret_key, algorithm="HS256")

    # Store refresh token in DB
    new_refresh_token = RefreshToken(
        user_id=user_id,
        token=refresh_token_str, # Store the encoded token string
        expires_at=datetime.fromtimestamp(refresh_token_payload["exp"], tz=timezone.utc)
    )
    db.session.add(new_refresh_token)
    db.session.commit()

    return access_token, refresh_token_str

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400

    # Check if user already exists
    if User.query.filter_by(email=email).first():
        return jsonify({"message": "Email already registered"}), 409

    # Create new user
    new_user = User(email=email)
    new_user.set_password(password) # Hash the password

    try:
        db.session.add(new_user)
        db.session.commit()
        # Optionally generate tokens immediately upon registration
        # access_token, refresh_token = _generate_tokens(new_user.id)
        # return jsonify({"message": "User registered successfully", "access_token": access_token, "refresh_token": refresh_token}), 201
        return jsonify({"message": "User registered successfully", "user_id": new_user.uuid}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Registration failed", "error": str(e)}), 500

# Placeholder for other auth routes (login, refresh, logout, forgot/reset password)
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400

    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(password):
        return jsonify({"message": "Invalid credentials"}), 401
    
    if not user.is_active:
        return jsonify({"message": "User account is inactive"}), 403

    try:
        access_token, refresh_token = _generate_tokens(user.id)
        return jsonify({
            "message": "Login successful",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {
                "uuid": user.uuid,
                "email": user.email,
                "plan": user.plan
            }
        }), 200
    except Exception as e:
        db.session.rollback() # Rollback in case token generation/saving failed
        return jsonify({"message": "Login failed during token generation", "error": str(e)}), 500

@auth_bp.route("/refresh", methods=["POST"])
def refresh():
    data = request.get_json()
    refresh_token_str = data.get("refresh_token")

    if not refresh_token_str:
        # Optionally check Authorization header: Bearer <token>
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            refresh_token_str = auth_header.split(" ")[1]
        else:
            return jsonify({"message": "Refresh token is required"}), 400

    secret_key = os.getenv("JWT_SECRET_KEY", "default_jwt_secret")

    try:
        # 1. Decode the token to get payload (doesn't verify signature yet)
        payload = jwt.decode(refresh_token_str, secret_key, algorithms=["HS256"], options={"verify_signature": True, "verify_exp": True})
        user_id = payload["user_id"]
        
        # 2. Verify token exists in DB and is not expired (double check)
        stored_token = RefreshToken.query.filter_by(token=refresh_token_str, user_id=user_id).first()
        
        if not stored_token or stored_token.is_expired():
             # If token not found or expired in DB, treat as invalid even if JWT is technically valid
             # This handles cases where a token was manually revoked/deleted
            return jsonify({"message": "Invalid or expired refresh token"}), 401

        # 3. Generate a new access token
        new_access_token_payload = {
            "user_id": user_id,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=15) # New expiry
        }
        new_access_token = jwt.encode(new_access_token_payload, secret_key, algorithm="HS256")

        # Note: Refresh token rotation is not implemented here for simplicity.
        # The original refresh token remains valid until its expiry.

        return jsonify({"access_token": new_access_token}), 200

    except jwt.ExpiredSignatureError:
        return jsonify({"message": "Refresh token has expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"message": "Invalid refresh token"}), 401
    except Exception as e:
        return jsonify({"message": "Token refresh failed", "error": str(e)}), 500

# @auth_bp.route("/logout", methods=["POST"])
# def logout():
#     pass


# Decorator para exigir autenticação JWT
from functools import wraps

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Tenta obter o token do header Authorization: Bearer <token>
        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]

        if not token:
            return jsonify({"message": "Token is missing!"}), 401

        secret_key = os.getenv("JWT_SECRET_KEY", "default_jwt_secret")
        try:
            # Verifica a validade do access token
            data = jwt.decode(token, secret_key, algorithms=["HS256"])
            current_user = User.query.get(data["user_id"])
            if not current_user or not current_user.is_active:
                 return jsonify({"message": "Token is invalid or user inactive!"}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token has expired!"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"message": "Token is invalid!"}), 401
        except Exception as e:
             return jsonify({"message": "Token validation error", "error": str(e)}), 500

        # Passa o usuário atual para a rota
        return f(current_user, *args, **kwargs)

    return decorated

@auth_bp.route("/logout", methods=["POST"])
@token_required # Exige um access token válido para fazer logout
def logout(current_user):
    data = request.get_json()
    refresh_token_str = data.get("refresh_token")

    if not refresh_token_str:
        return jsonify({"message": "Refresh token is required for logout"}), 400

    try:
        # Encontra e deleta o refresh token específico do banco de dados
        # Garante que o token pertence ao usuário logado (current_user.id)
        stored_token = RefreshToken.query.filter_by(token=refresh_token_str, user_id=current_user.id).first()

        if stored_token:
            db.session.delete(stored_token)
            db.session.commit()
            return jsonify({"message": "Logout successful"}), 200
        else:
            # Token não encontrado ou não pertence ao usuário - pode já ter sido invalidado
            return jsonify({"message": "Invalid refresh token or already logged out"}), 400

    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Logout failed", "error": str(e)}), 500

# Placeholder for forgot/reset password
# @auth_bp.route("/forgot-password", methods=["POST"])
# def forgot_password():
#     pass

# @auth_bp.route("/reset-password", methods=["POST"])
# def reset_password():
#     pass


# Placeholder for forgot/reset password
from itsdangerous import URLSafeTimedSerializer

# Helper to create a serializer for password reset tokens
def get_reset_token_serializer():
    secret_key = os.getenv("SECRET_KEY", "default_secret_key_for_serializer") # Use a strong, separate key if possible
    return URLSafeTimedSerializer(secret_key, salt="password-reset-salt")

@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json()
    email = data.get("email")

    if not email:
        return jsonify({"message": "Email is required"}), 400

    user = User.query.filter_by(email=email).first()

    if not user:
        # Don't reveal if the email exists or not for security
        return jsonify({"message": "If an account with that email exists, a password reset link has been sent."}), 200

    serializer = get_reset_token_serializer()
    # Token expires in 1 hour (3600 seconds)
    token = serializer.dumps(user.email, salt="password-reset-salt")

    # TODO: Send email with the reset link
    # reset_url = f"https://your-frontend-url/reset-password?token={token}"
    # print(f"Password reset link for {user.email}: {reset_url}") # Simulate sending email

    # For now, return the token for testing purposes
    return jsonify({
        "message": "Password reset token generated (simulation - normally sent via email)",
        "reset_token": token
    }), 200

@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json()
    token = data.get("token")
    new_password = data.get("new_password")

    if not token or not new_password:
        return jsonify({"message": "Token and new password are required"}), 400

    serializer = get_reset_token_serializer()
    try:
        # Verifica o token e obtém o email (expira em 1 hora por padrão)
        email = serializer.loads(token, salt="password-reset-salt", max_age=3600)
    except Exception as e: # Captura SignatureExpired, BadTimeSignature, etc.
        return jsonify({"message": "Invalid or expired password reset token", "error": str(e)}), 400

    user = User.query.filter_by(email=email).first()

    if not user:
        # Teoricamente, não deveria acontecer se o token foi gerado corretamente
        return jsonify({"message": "User not found for this token"}), 404
    
    if not user.is_active:
        return jsonify({"message": "User account is inactive"}), 403

    try:
        user.set_password(new_password)
        db.session.commit()
        # Opcional: Invalidar todos os refresh tokens existentes para este usuário após reset de senha
        RefreshToken.query.filter_by(user_id=user.id).delete()
        db.session.commit()
        return jsonify({"message": "Password has been reset successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Password reset failed", "error": str(e)}), 500

