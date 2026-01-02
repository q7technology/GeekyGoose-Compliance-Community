"""
Celery worker tasks for document processing and AI scanning.
"""
import json
import logging
from typing import List, Dict, Any
from celery_app import celery_app
from database import SessionLocal
from models import Document, DocumentPage, Scan, ScanResult, Gap, Requirement, Control, EvidenceLink, DocumentControlLink
from text_extraction import text_extractor
from ai_scanner import compliance_scanner
from storage import storage

logger = logging.getLogger(__name__)

@celery_app.task(bind=True)
def extract_document_text(self, document_id: str):
    """
    Extract text from uploaded document and store in document_pages table.
    """
    db = SessionLocal()
    try:
        # Get document from database
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            raise ValueError(f"Document {document_id} not found")
        
        logger.info(f"Starting text extraction for document {document.filename}")
        
        # Download file from storage
        file_content = storage.download_file(document.storage_key)
        
        # Extract text pages
        pages = text_extractor.extract_text(
            file_content, 
            document.filename, 
            document.mime_type
        )
        
        # Store extracted text in database
        for page_data in pages:
            doc_page = DocumentPage(
                document_id=document.id,
                page_num=page_data["page_num"],
                text=page_data["text"]
            )
            db.add(doc_page)
        
        db.commit()
        
        logger.info(f"Text extraction completed for document {document.filename}. Extracted {len(pages)} pages.")
        
        return {
            "status": "success",
            "document_id": str(document.id),
            "pages_extracted": len(pages)
        }
        
    except Exception as e:
        logger.error(f"Error extracting text for document {document_id}: {str(e)}")
        db.rollback()
        raise self.retry(exc=e, countdown=60, max_retries=3)
    finally:
        db.close()

@celery_app.task(bind=True)
def process_scan(self, scan_id: str):
    """
    Process a compliance scan using AI.
    """
    db = SessionLocal()
    try:
        # Get scan from database
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        if not scan:
            raise ValueError(f"Scan {scan_id} not found")
        
        logger.info(f"Starting compliance scan {scan_id} for control {scan.control.code}")

        # Get AI provider and model from settings
        from models import Settings
        settings = db.query(Settings).filter(Settings.id == 1).first()
        if settings:
            if settings.ai_provider == 'ollama':
                model_name = f"{settings.ollama_model} (Ollama)"
            elif settings.ai_provider == 'openai':
                model_name = settings.openai_model or 'gpt-4o-mini'
            else:
                model_name = 'gpt-4'
        else:
            model_name = 'gpt-4'

        # Get control and requirements first to set total
        control = scan.control
        requirements = db.query(Requirement).filter(Requirement.control_id == control.id).all()

        # Update scan status with initial progress
        scan.status = 'processing'
        scan.model = model_name
        scan.prompt_version = 'v1.0'
        scan.progress_percentage = 0
        scan.current_step = 'Initializing scan...'
        scan.total_requirements = len(requirements)
        scan.processed_requirements = 0
        db.commit()
        
        # Get linked evidence documents (both manual and AI-linked)
        # Manual evidence links
        manual_evidence_links = db.query(EvidenceLink).filter(
            EvidenceLink.org_id == scan.org_id,
            EvidenceLink.control_id == control.id
        ).all()

        # AI-linked evidence
        ai_evidence_links = db.query(DocumentControlLink).filter(
            DocumentControlLink.control_id == control.id
        ).all()

        total_evidence = len(manual_evidence_links) + len(ai_evidence_links)

        if total_evidence == 0:
            logger.warning(f"No evidence linked to control {control.code} for scan {scan_id}")
            scan.status = 'completed'
            scan.progress_percentage = 100
            scan.current_step = 'No evidence to scan'
            db.commit()
            return {"status": "completed", "message": "No evidence to scan"}

        logger.info(f"Found {len(manual_evidence_links)} manual + {len(ai_evidence_links)} AI-linked evidence for control {control.code}")

        # Update progress: gathering evidence
        scan.progress_percentage = 10
        scan.current_step = f'Gathering evidence from {total_evidence} documents...'
        db.commit()

        # Gather evidence text from both sources
        evidence_texts = []

        # Process manual evidence links
        for link in manual_evidence_links:
            document_pages = db.query(DocumentPage).filter(
                DocumentPage.document_id == link.document_id
            ).all()

            for page in document_pages:
                if page.text:
                    evidence_texts.append({
                        "document_id": str(link.document_id),
                        "document_name": link.document.filename,
                        "page_num": page.page_num,
                        "text": page.text
                    })

        # Process AI-linked evidence
        for link in ai_evidence_links:
            document_pages = db.query(DocumentPage).filter(
                DocumentPage.document_id == link.document_id
            ).all()

            for page in document_pages:
                if page.text:
                    evidence_texts.append({
                        "document_id": str(link.document_id),
                        "document_name": link.document.filename,
                        "page_num": page.page_num,
                        "text": page.text
                    })

        # Update progress: starting AI analysis
        scan.progress_percentage = 20
        scan.current_step = f'Analyzing {len(requirements)} requirements with AI...'
        db.commit()

        # Run AI scan
        scan_results = compliance_scanner.scan_control(
            control=control,
            requirements=requirements,
            evidence_texts=evidence_texts
        )

        # Update progress: AI analysis complete
        scan.progress_percentage = 80
        scan.current_step = 'Storing scan results...'
        db.commit()
        
        # Store scan results
        for result in scan_results["requirements"]:
            # JSON-encode for SQLAlchemy JSONB adapter
            rationale_json = json.dumps(result.get("rationale", ""))
            citations_json = json.dumps(result.get("citations", []))
            
            scan_result = ScanResult(
                scan_id=scan.id,
                requirement_id=result["requirement_id"],
                outcome=result["outcome"],
                confidence=str(result["confidence"]),
                rationale_json=rationale_json,
                citations_json=citations_json
            )
            db.add(scan_result)
        
        # Store gaps
        for gap in scan_results["gaps"]:
            # Ensure recommended_actions is properly serialized
            recommended_actions = gap.get("recommended_actions", [])
            if isinstance(recommended_actions, (list, dict)):
                recommended_actions_json = json.dumps(recommended_actions)
            elif isinstance(recommended_actions, str):
                # Try to parse and re-serialize to ensure valid JSON
                try:
                    parsed = json.loads(recommended_actions)
                    recommended_actions_json = json.dumps(parsed)
                except json.JSONDecodeError:
                    recommended_actions_json = json.dumps([])
            else:
                recommended_actions_json = json.dumps([])
            
            gap_record = Gap(
                scan_id=scan.id,
                requirement_id=gap["requirement_id"],
                gap_summary=gap["summary"],
                recommended_actions_json=recommended_actions_json
            )
            db.add(gap_record)
        
        # Update scan status
        scan.status = 'completed'
        scan.progress_percentage = 100
        scan.current_step = 'Scan completed'
        scan.processed_requirements = len(requirements)
        db.commit()

        logger.info(f"Compliance scan {scan_id} completed successfully")
        
        return {
            "status": "success",
            "scan_id": str(scan.id),
            "requirements_processed": len(scan_results["requirements"]),
            "gaps_found": len(scan_results["gaps"])
        }
        
    except Exception as e:
        logger.error(f"Error processing scan {scan_id}: {str(e)}")
        # Update scan status to failed
        scan.status = 'failed'
        scan.current_step = f'Error: {str(e)[:100]}'
        db.commit()
        db.rollback()
        raise self.retry(exc=e, countdown=60, max_retries=3)
    finally:
        db.close()

@celery_app.task
def cleanup_old_scans():
    """
    Cleanup old scan results (run periodically).
    """
    db = SessionLocal()
    try:
        # This could clean up scans older than 30 days, etc.
        # For now, just a placeholder
        logger.info("Cleanup task executed")
        return {"status": "success", "message": "Cleanup completed"}
    finally:
        db.close()