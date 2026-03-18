from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, JSON, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from src.core.models import Base
import uuid

class TeamInvitation(Base):
    __tablename__ = 'team_invitations'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('companies.id'), nullable=False)
    inviter_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    email = Column(Text, nullable=False)
    status = Column(String, default='pending') # pending, accepted, expired
    created_at = Column(DateTime, default=func.now())
