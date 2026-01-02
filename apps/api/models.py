import uuid
from sqlalchemy import Column, String, DateTime, Integer, Text, BigInteger, ForeignKey, Float, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class Org(Base):
    __tablename__ = "orgs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    plan = Column(String(50), default='free')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    users = relationship("User", back_populates="org")
    documents = relationship("Document", back_populates="org")

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(50), default='user')
    password_hash = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    org = relationship("Org", back_populates="users")

class Framework(Base):
    __tablename__ = "frameworks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    version = Column(String(50))
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    controls = relationship("Control", back_populates="framework")

class Control(Base):
    __tablename__ = "controls"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    framework_id = Column(UUID(as_uuid=True), ForeignKey("frameworks.id"), nullable=False)
    code = Column(String(50), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    framework = relationship("Framework", back_populates="controls")
    requirements = relationship("Requirement", back_populates="control")

class Requirement(Base):
    __tablename__ = "requirements"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    control_id = Column(UUID(as_uuid=True), ForeignKey("controls.id"), nullable=False)
    req_code = Column(String(50), nullable=False)
    text = Column(Text, nullable=False)
    maturity_level = Column(Integer, nullable=False)
    guidance = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    control = relationship("Control", back_populates="requirements")

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(500), nullable=False)
    mime_type = Column(String(100))
    storage_key = Column(String(1000), nullable=False)
    file_size = Column(BigInteger)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    sha256 = Column(String(64))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Performance: Add indexes for frequently queried fields
    __table_args__ = (
        Index('idx_document_org_id', 'org_id'),
        Index('idx_document_created_at', 'created_at'),
        Index('idx_document_uploaded_by', 'uploaded_by'),
        Index('idx_document_sha256', 'sha256'),
    )
    
    org = relationship("Org", back_populates="documents")
    uploader = relationship("User")
    pages = relationship("DocumentPage", back_populates="document", cascade="all, delete-orphan")
    control_links = relationship("DocumentControlLink", back_populates="document", cascade="all, delete-orphan")

class DocumentPage(Base):
    __tablename__ = "document_pages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    page_num = Column(Integer, nullable=False)
    text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Performance: Add indexes for document queries
    __table_args__ = (
        Index('idx_document_page_document_id', 'document_id'),
        Index('idx_document_page_num', 'document_id', 'page_num'),
    )
    
    document = relationship("Document", back_populates="pages")

class EvidenceLink(Base):
    __tablename__ = "evidence_links"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    control_id = Column(UUID(as_uuid=True), ForeignKey("controls.id"), nullable=False)
    requirement_id = Column(UUID(as_uuid=True), ForeignKey("requirements.id"), nullable=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    org = relationship("Org")
    control = relationship("Control")
    requirement = relationship("Requirement")
    document = relationship("Document")

class DocumentControlLink(Base):
    __tablename__ = "document_control_links"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    control_id = Column(UUID(as_uuid=True), ForeignKey("controls.id", ondelete="CASCADE"), nullable=False)
    confidence = Column(Float, nullable=False, default=0.0)
    reasoning = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    # Performance: Add indexes for link queries and prevent duplicates
    __table_args__ = (
        Index('idx_doc_control_link_document_id', 'document_id'),
        Index('idx_doc_control_link_control_id', 'control_id'),
        Index('idx_doc_control_link_confidence', 'confidence'),
        Index('idx_doc_control_unique', 'document_id', 'control_id', unique=True),
    )
    
    document = relationship("Document", back_populates="control_links")
    control = relationship("Control")

class Scan(Base):
    __tablename__ = "scans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    control_id = Column(UUID(as_uuid=True), ForeignKey("controls.id"), nullable=False)
    status = Column(String(50), nullable=False, default='pending')  # pending, processing, completed, failed
    model = Column(String(100))
    prompt_version = Column(String(50))
    progress_percentage = Column(Integer, default=0)
    current_step = Column(Text, default='Initializing...')
    total_requirements = Column(Integer, default=0)
    processed_requirements = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    org = relationship("Org")
    control = relationship("Control")
    results = relationship("ScanResult", back_populates="scan")
    gaps = relationship("Gap", back_populates="scan")

class ScanResult(Base):
    __tablename__ = "scan_results"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scan_id = Column(UUID(as_uuid=True), ForeignKey("scans.id"), nullable=False)
    requirement_id = Column(UUID(as_uuid=True), ForeignKey("requirements.id"), nullable=False)
    outcome = Column(String(20), nullable=False)  # PASS, PARTIAL, FAIL, NOT_FOUND
    confidence = Column(String(10), nullable=False)  # stored as string "0.85" etc
    rationale_json = Column(Text)  # JSON string
    citations_json = Column(Text)  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
    
    scan = relationship("Scan", back_populates="results")
    requirement = relationship("Requirement")

class Gap(Base):
    __tablename__ = "gaps"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scan_id = Column(UUID(as_uuid=True), ForeignKey("scans.id"), nullable=False)
    requirement_id = Column(UUID(as_uuid=True), ForeignKey("requirements.id"), nullable=False)
    gap_summary = Column(Text, nullable=False)
    recommended_actions_json = Column(Text)  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
    
    scan = relationship("Scan", back_populates="gaps")
    requirement = relationship("Requirement")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("orgs.id"), nullable=False)
    actor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(100), nullable=False)
    meta_json = Column(Text)  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)

    org = relationship("Org")
    actor = relationship("User")

class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, default=1)  # Singleton pattern
    ai_provider = Column(String(50), default='ollama')
    openai_api_key = Column(String(500))
    openai_model = Column(String(100), default='gpt-4o')
    openai_endpoint = Column(String(500))
    openai_vision_model = Column(String(100), default='gpt-4o')
    ollama_endpoint = Column(String(500), default='http://host.docker.internal:11434')
    ollama_model = Column(String(100), default='qwen2.5:14b')
    ollama_vision_model = Column(String(100), default='qwen2-vl')
    ollama_context_size = Column(Integer, default=131072)
    min_confidence_threshold = Column(Float, default=0.90)
    use_dual_vision_validation = Column(Integer, default=0)  # SQLite boolean (0/1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)