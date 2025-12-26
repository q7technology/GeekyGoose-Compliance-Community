import os
import uuid
import json
import requests
import logging
from typing import List, Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from database import get_db
from models import Document, Org, User, Framework, Control, Requirement, EvidenceLink, Scan, ScanResult, Gap
from storage import storage
from worker_tasks import extract_document_text, process_scan
from pydantic import BaseModel
from init_db import initialize_database

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def _safe_json_loads(json_str: Optional[str], default=None):
    """Safely parse JSON string, returning default value if parsing fails."""
    if not json_str:
        return default
    try:
        return json.loads(json_str)
    except (json.JSONDecodeError, TypeError) as e:
        logger.warning(f"Invalid JSON data in database - returning default. Content: {json_str[:100]}... Error: {e}")
        return default

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting GeekyGoose Compliance API...")
    
    # Initialize database on startup
    if not initialize_database():
        logger.error("Database initialization failed!")
        raise RuntimeError("Database initialization failed")
    
    logger.info("GeekyGoose Compliance API startup complete")
    yield
    # Shutdown
    logger.info("GeekyGoose Compliance API shutting down...")

app = FastAPI(
    title="GeekyGoose Compliance API",
    description="Compliance automation platform for SMB + internal IT teams",
    version="0.1.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Allowed file types
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/png",
    "image/jpeg"
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

@app.get("/")
async def root():
    return {"message": "GeekyGoose Compliance API is running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Validate file type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type {file.content_type} not allowed. Allowed types: {', '.join(ALLOWED_MIME_TYPES)}"
        )
    
    # Check file size
    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    # Reset file position
    await file.seek(0)
    
    try:
        # Upload to storage
        storage_key, sha256_hash, file_size = storage.upload_file(
            file.file, file.filename, file.content_type
        )
        
        # For demo purposes, create a default org and user if they don't exist
        org = db.query(Org).first()
        if not org:
            org = Org(id=uuid.uuid4(), name="Demo Organization")
            db.add(org)
            db.commit()
            db.refresh(org)
        
        user = db.query(User).filter(User.org_id == org.id).first()
        if not user:
            user = User(
                id=uuid.uuid4(),
                org_id=org.id,
                email="demo@example.com",
                name="Demo User"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        
        # Save to database
        document = Document(
            org_id=org.id,
            filename=file.filename,
            mime_type=file.content_type,
            storage_key=storage_key,
            file_size=file_size,
            uploaded_by=user.id,
            sha256=sha256_hash
        )
        
        db.add(document)
        db.commit()
        db.refresh(document)
        
        return {
            "id": str(document.id),
            "filename": document.filename,
            "mime_type": document.mime_type,
            "file_size": document.file_size,
            "sha256": document.sha256,
            "created_at": document.created_at.isoformat(),
            "download_url": storage.get_download_url(storage_key)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.get("/documents")
async def list_documents(db: Session = Depends(get_db)):
    documents = db.query(Document).order_by(Document.created_at.desc()).all()
    
    result = []
    for doc in documents:
        result.append({
            "id": str(doc.id),
            "filename": doc.filename,
            "mime_type": doc.mime_type,
            "file_size": doc.file_size,
            "created_at": doc.created_at.isoformat(),
            "download_url": storage.get_download_url(doc.storage_key)
        })
    
    return {"documents": result}

@app.delete("/documents/{document_id}")
async def delete_document(document_id: str, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        # Delete from storage
        storage.delete_file(document.storage_key)
        
        # Delete from database
        db.delete(document)
        db.commit()
        
        return {"message": "Document deleted successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")

# Pydantic models for API requests
class LinkEvidenceRequest(BaseModel):
    control_id: str
    requirement_id: Optional[str] = None
    note: Optional[str] = None

class CreateScanRequest(BaseModel):
    control_id: str

# Frameworks and Controls endpoints
@app.get("/frameworks")
async def list_frameworks(db: Session = Depends(get_db)):
    """List all available compliance frameworks."""
    frameworks = db.query(Framework).all()
    return {
        "frameworks": [
            {
                "id": str(f.id),
                "name": f.name,
                "version": f.version,
                "description": f.description,
                "created_at": f.created_at.isoformat()
            }
            for f in frameworks
        ]
    }

@app.get("/frameworks/{framework_id}/controls")
async def list_controls(framework_id: str, db: Session = Depends(get_db)):
    """List all controls for a framework."""
    controls = db.query(Control).filter(Control.framework_id == framework_id).all()
    
    result = []
    for control in controls:
        requirements = db.query(Requirement).filter(Requirement.control_id == control.id).all()
        result.append({
            "id": str(control.id),
            "code": control.code,
            "title": control.title,
            "description": control.description,
            "requirements_count": len(requirements),
            "created_at": control.created_at.isoformat()
        })
    
    return {"controls": result}

@app.get("/controls/{control_id}")
async def get_control_details(control_id: str, db: Session = Depends(get_db)):
    """Get detailed information about a specific control."""
    control = db.query(Control).filter(Control.id == control_id).first()
    if not control:
        raise HTTPException(status_code=404, detail="Control not found")
    
    requirements = db.query(Requirement).filter(Requirement.control_id == control.id).all()
    
    return {
        "id": str(control.id),
        "framework_id": str(control.framework_id),
        "framework_name": control.framework.name,
        "code": control.code,
        "title": control.title,
        "description": control.description,
        "requirements": [
            {
                "id": str(req.id),
                "req_code": req.req_code,
                "text": req.text,
                "maturity_level": req.maturity_level,
                "guidance": req.guidance
            }
            for req in requirements
        ],
        "created_at": control.created_at.isoformat()
    }

@app.post("/documents/{document_id}/link-evidence")
async def link_evidence_to_control(
    document_id: str,
    request: LinkEvidenceRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Link a document as evidence for a control/requirement."""
    
    # Verify document exists
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Verify control exists
    control = db.query(Control).filter(Control.id == request.control_id).first()
    if not control:
        raise HTTPException(status_code=404, detail="Control not found")
    
    # Verify requirement exists if provided
    requirement = None
    if request.requirement_id:
        requirement = db.query(Requirement).filter(Requirement.id == request.requirement_id).first()
        if not requirement:
            raise HTTPException(status_code=404, detail="Requirement not found")
    
    # Check if link already exists
    existing = db.query(EvidenceLink).filter(
        EvidenceLink.document_id == document_id,
        EvidenceLink.control_id == request.control_id,
        EvidenceLink.requirement_id == request.requirement_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Evidence link already exists")
    
    # Create evidence link
    evidence_link = EvidenceLink(
        org_id=document.org_id,
        control_id=request.control_id,
        requirement_id=request.requirement_id,
        document_id=document_id,
        note=request.note
    )
    
    db.add(evidence_link)
    db.commit()
    
    # Trigger text extraction in background if not already done
    background_tasks.add_task(extract_document_text.delay, str(document.id))
    
    return {
        "message": "Evidence linked successfully",
        "link_id": str(evidence_link.id)
    }

@app.get("/controls/{control_id}/evidence")
async def get_control_evidence(control_id: str, db: Session = Depends(get_db)):
    """Get all evidence linked to a control."""
    
    # Get all evidence links for the control
    evidence_links = db.query(EvidenceLink).filter(
        EvidenceLink.control_id == control_id
    ).all()
    
    result = []
    for link in evidence_links:
        result.append({
            "id": str(link.id),
            "document": {
                "id": str(link.document.id),
                "filename": link.document.filename,
                "mime_type": link.document.mime_type,
                "file_size": link.document.file_size,
                "created_at": link.document.created_at.isoformat(),
                "download_url": storage.get_download_url(link.document.storage_key)
            },
            "requirement": {
                "id": str(link.requirement.id),
                "req_code": link.requirement.req_code,
                "text": link.requirement.text
            } if link.requirement else None,
            "note": link.note,
            "created_at": link.created_at.isoformat()
        })
    
    return {"evidence": result}

@app.post("/controls/{control_id}/scan")
async def create_scan(
    control_id: str,
    db: Session = Depends(get_db)
):
    """Create a new compliance scan for a control."""
    
    # Verify control exists
    control = db.query(Control).filter(Control.id == control_id).first()
    if not control:
        raise HTTPException(status_code=404, detail="Control not found")
    
    # For demo, get default org
    org = db.query(Org).first()
    if not org:
        raise HTTPException(status_code=400, detail="No organization found")
    
    # Check if there's evidence linked to this control
    evidence_count = db.query(EvidenceLink).filter(
        EvidenceLink.control_id == control_id,
        EvidenceLink.org_id == org.id
    ).count()
    
    if evidence_count == 0:
        raise HTTPException(
            status_code=400, 
            detail="No evidence linked to this control. Please upload and link evidence documents first."
        )
    
    # Create scan record
    scan = Scan(
        org_id=org.id,
        control_id=control_id,
        status='pending'
    )
    
    db.add(scan)
    db.commit()
    db.refresh(scan)
    
    # Start background scan processing
    process_scan.delay(str(scan.id))
    
    return {
        "scan_id": str(scan.id),
        "status": "pending",
        "message": "Scan started. Check status using the scan_id."
    }

@app.get("/scans/{scan_id}")
async def get_scan_status(scan_id: str, db: Session = Depends(get_db)):
    """Get the status and results of a scan."""
    
    scan = db.query(Scan).filter(Scan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    # Get scan results
    results = db.query(ScanResult).filter(ScanResult.scan_id == scan.id).all()
    gaps = db.query(Gap).filter(Gap.scan_id == scan.id).all()
    
    return {
        "id": str(scan.id),
        "control": {
            "id": str(scan.control.id),
            "code": scan.control.code,
            "title": scan.control.title
        },
        "status": scan.status,
        "model": scan.model,
        "prompt_version": scan.prompt_version,
        "created_at": scan.created_at.isoformat(),
        "updated_at": scan.updated_at.isoformat(),
        "results": [
            {
                "requirement": {
                    "id": str(result.requirement.id),
                    "req_code": result.requirement.req_code,
                    "text": result.requirement.text,
                    "maturity_level": result.requirement.maturity_level
                },
                "outcome": result.outcome,
                "confidence": result.confidence,
                "rationale": _safe_json_loads(result.rationale_json),
                "citations": _safe_json_loads(result.citations_json, default=[])
            }
            for result in results
        ],
        "gaps": [
            {
                "requirement": {
                    "id": str(gap.requirement.id),
                    "req_code": gap.requirement.req_code,
                    "text": gap.requirement.text
                },
                "summary": gap.gap_summary,
                "recommended_actions": _safe_json_loads(gap.recommended_actions_json, default=[])
            }
            for gap in gaps
        ]
    }

@app.get("/controls/{control_id}/scans")
async def get_control_scans(control_id: str, db: Session = Depends(get_db)):
    """Get all scans for a control."""
    
    scans = db.query(Scan).filter(
        Scan.control_id == control_id
    ).order_by(Scan.created_at.desc()).all()
    
    return {
        "scans": [
            {
                "id": str(scan.id),
                "status": scan.status,
                "model": scan.model,
                "prompt_version": scan.prompt_version,
                "created_at": scan.created_at.isoformat()
            }
            for scan in scans
        ]
    }

# AI Settings endpoints
class AISettingsRequest(BaseModel):
    provider: str  # 'openai' or 'ollama'
    openai_api_key: Optional[str] = None
    openai_model: Optional[str] = 'gpt-4o-mini'
    ollama_endpoint: Optional[str] = 'http://localhost:11434'
    ollama_model: Optional[str] = 'llama2'

@app.get("/settings/ai")
async def get_ai_settings():
    """Get current AI provider settings."""
    return {
        "provider": os.getenv("AI_PROVIDER", "openai"),
        "openai_model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        "ollama_endpoint": os.getenv("OLLAMA_ENDPOINT", "http://localhost:11434"),
        "ollama_model": os.getenv("OLLAMA_MODEL", "llama2"),
        # Don't return API key for security
        "openai_api_key": "***" if os.getenv("OPENAI_API_KEY") else None
    }

@app.post("/settings/ai")
async def save_ai_settings(settings: AISettingsRequest):
    """Save AI provider settings."""
    # In a production app, you'd save these to a database or config file
    # For now, we'll update environment variables for this session
    os.environ["AI_PROVIDER"] = settings.provider
    
    if settings.provider == "openai":
        if settings.openai_api_key and settings.openai_api_key != "***":
            os.environ["OPENAI_API_KEY"] = settings.openai_api_key
        if settings.openai_model:
            os.environ["OPENAI_MODEL"] = settings.openai_model
    elif settings.provider == "ollama":
        if settings.ollama_endpoint:
            os.environ["OLLAMA_ENDPOINT"] = settings.ollama_endpoint
        if settings.ollama_model:
            os.environ["OLLAMA_MODEL"] = settings.ollama_model
    
    return {"message": "Settings saved successfully"}

@app.post("/settings/ai/test")
async def test_ai_connection(settings: AISettingsRequest):
    """Test connection to the specified AI provider."""
    try:
        if settings.provider == "openai":
            from openai import OpenAI
            
            if not settings.openai_api_key or settings.openai_api_key == "***":
                api_key = os.getenv("OPENAI_API_KEY")
            else:
                api_key = settings.openai_api_key
                
            if not api_key:
                raise HTTPException(status_code=400, detail="OpenAI API key is required")
            
            client = OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model=settings.openai_model or "gpt-4o-mini",
                messages=[{"role": "user", "content": "Reply with exactly: 'OpenAI connection successful'"}],
                max_tokens=10
            )
            
            return {
                "status": "success",
                "test_response": response.choices[0].message.content,
                "model": settings.openai_model or "gpt-4o-mini"
            }
            
        elif settings.provider == "ollama":
            import requests
            
            endpoint = settings.ollama_endpoint or "http://localhost:11434"
            model = settings.ollama_model or "llama2"
            
            # Test Ollama connection
            response = requests.post(
                f"{endpoint}/api/generate",
                json={
                    "model": model,
                    "prompt": "Reply with exactly: 'Ollama connection successful'",
                    "stream": False
                },
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    "status": "success",
                    "test_response": result.get("response", "Connection successful"),
                    "model": model
                }
            else:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Ollama returned status {response.status_code}: {response.text}"
                )
        else:
            raise HTTPException(status_code=400, detail="Invalid AI provider")
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Connection test failed: {str(e)}")

@app.get("/settings/ollama/models")
async def get_ollama_models(endpoint: str = "http://localhost:11434"):
    """Get list of available models from Ollama instance."""
    try:
        import requests
        
        # Get list of models from Ollama
        response = requests.get(f"{endpoint}/api/tags", timeout=10)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot connect to Ollama at {endpoint}. Make sure Ollama is running."
            )
        
        data = response.json()
        models = []
        
        for model in data.get('models', []):
            name = model.get('name', '')
            size = model.get('size', 0)
            modified = model.get('modified_at', '')
            
            # Format model info
            size_gb = round(size / (1024**3), 1) if size > 0 else 0
            models.append({
                'name': name,
                'display_name': name.split(':')[0],  # Remove tag for display
                'size_gb': size_gb,
                'modified_at': modified,
                'family': get_model_family(name)
            })
        
        # Sort by family and name
        models.sort(key=lambda x: (x['family'], x['name']))
        
        return {
            "models": models,
            "endpoint": endpoint,
            "total_models": len(models)
        }
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(
            status_code=400, 
            detail=f"Failed to connect to Ollama: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching models: {str(e)}")

@app.get("/settings/ollama/models/demo")
async def get_demo_ollama_models():
    """Demo response showing what Ollama models look like when available."""
    return {
        "models": [
            {
                "name": "llama3:8b",
                "display_name": "llama3",
                "size_gb": 4.7,
                "modified_at": "2024-12-25T10:00:00Z",
                "family": "Llama"
            },
            {
                "name": "llama2:7b",
                "display_name": "llama2",
                "size_gb": 3.8,
                "modified_at": "2024-12-20T15:30:00Z",
                "family": "Llama"
            },
            {
                "name": "mistral:7b",
                "display_name": "mistral",
                "size_gb": 4.1,
                "modified_at": "2024-12-22T12:00:00Z",
                "family": "Mistral"
            },
            {
                "name": "codellama:7b",
                "display_name": "codellama",
                "size_gb": 3.8,
                "modified_at": "2024-12-18T09:15:00Z",
                "family": "Code Llama"
            }
        ],
        "endpoint": "http://localhost:11434",
        "total_models": 4,
        "demo": True
    }

def get_model_family(model_name: str) -> str:
    """Categorize model by family for better organization."""
    name_lower = model_name.lower()
    
    if 'llama' in name_lower:
        return 'Llama'
    elif 'mistral' in name_lower:
        return 'Mistral'
    elif 'mixtral' in name_lower:
        return 'Mixtral'
    elif 'codellama' in name_lower:
        return 'Code Llama'
    elif 'phi' in name_lower:
        return 'Phi'
    elif 'gemma' in name_lower:
        return 'Gemma'
    elif 'qwen' in name_lower:
        return 'Qwen'
    else:
        return 'Other'

# Additional API endpoints for control details and reporting

@app.get("/controls/{control_id}")
async def get_control_details(control_id: str):
    """Get detailed information about a specific control including requirements."""
    db = SessionLocal()
    try:
        control = db.query(Control).filter(Control.id == control_id).first()
        if not control:
            raise HTTPException(status_code=404, detail="Control not found")
        
        requirements = db.query(Requirement).filter(Requirement.control_id == control.id).all()
        
        return {
            "id": str(control.id),
            "framework_id": str(control.framework_id),
            "framework_name": control.framework.name,
            "code": control.code,
            "title": control.title,
            "description": control.description,
            "requirements": [
                {
                    "id": str(req.id),
                    "req_code": req.req_code,
                    "text": req.text,
                    "maturity_level": req.maturity_level,
                    "guidance": req.guidance
                }
                for req in requirements
            ],
            "created_at": control.created_at.isoformat()
        }
    finally:
        db.close()

@app.get("/controls/{control_id}/evidence")
async def get_control_evidence(control_id: str):
    """Get evidence linked to a specific control."""
    db = SessionLocal()
    try:
        evidence_links = db.query(EvidenceLink).filter(
            EvidenceLink.control_id == control_id
        ).all()
        
        evidence = []
        for link in evidence_links:
            document = link.document
            requirement = link.requirement if link.requirement_id else None
            
            evidence.append({
                "id": str(link.id),
                "document": {
                    "id": str(document.id),
                    "filename": document.filename,
                    "mime_type": document.mime_type,
                    "file_size": document.file_size,
                    "created_at": document.created_at.isoformat(),
                    "download_url": storage.get_download_url(document.storage_key)
                },
                "requirement": {
                    "id": str(requirement.id),
                    "req_code": requirement.req_code,
                    "text": requirement.text
                } if requirement else None,
                "note": link.note,
                "created_at": link.created_at.isoformat()
            })
        
        return {"evidence": evidence}
    finally:
        db.close()

@app.get("/controls/{control_id}/scans")
async def get_control_scans(control_id: str):
    """Get all scans for a specific control."""
    db = SessionLocal()
    try:
        scans = db.query(Scan).filter(
            Scan.control_id == control_id
        ).order_by(Scan.created_at.desc()).all()
        
        scan_list = []
        for scan in scans:
            scan_list.append({
                "id": str(scan.id),
                "status": scan.status,
                "model": scan.model,
                "prompt_version": scan.prompt_version,
                "created_at": scan.created_at.isoformat(),
                "updated_at": scan.updated_at.isoformat()
            })
        
        return {"scans": scan_list}
    finally:
        db.close()