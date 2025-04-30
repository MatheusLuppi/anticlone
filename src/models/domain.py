
from src.database import db
from datetime import datetime

class Domain(db.Model):
    __tablename__ = 'domains'

    id = db.Column(db.Integer, primary_key=True)
    domain_name = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    action_if_cloned = db.Column(db.String(50), default='none')  # 'redirect', 'hide', 'replace_links', 'none'
    action_target = db.Column(db.String(255), nullable=True)

    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    access_logs = db.relationship('AccessLog', backref='domain', lazy=True)
