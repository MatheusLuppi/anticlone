
from src.database import db
from datetime import datetime

class AccessLog(db.Model):
    __tablename__ = 'access_logs'

    id = db.Column(db.Integer, primary_key=True)
    domain_id = db.Column(db.Integer, db.ForeignKey('domains.id'), nullable=False)
    cloned_from_domain = db.Column(db.String(255))
    user_agent = db.Column(db.Text)
    ip_address = db.Column(db.String(45))
    referer = db.Column(db.Text)
    action_taken = db.Column(db.String(50))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
