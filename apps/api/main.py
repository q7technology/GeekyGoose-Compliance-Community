import os
import uuid
import json
import json as json_module
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

def _safe_json_loads(json_data, default=None):
    """Safely parse JSON data, returning default value if parsing fails."""
    if json_data is None:
        return default
    
    # If it's already a Python object (list, dict), return it directly
    if isinstance(json_data, (list, dict)):
        return json_data
    
    # If it's a string, try to parse as JSON
    if isinstance(json_data, str):
        if not json_data.strip():
            return default
        try:
            return json.loads(json_data)
        except json.JSONDecodeError as e:
            logger.warning(f"Invalid JSON string in database - returning default. Content: {json_data[:100]}... Error: {e}")
            return default
    
    # For any other type, log and return default
    logger.warning(f"Unexpected data type in database - returning default. Type: {type(json_data)}, Content: {str(json_data)[:100]}...")
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

# CORS middleware - Allow requests from Next.js container and localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "http://web:3000",  # Allow from Next.js container
        "*"  # Allow all origins since Next.js will proxy requests
    ],
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

async def analyze_file_content_for_controls(file: UploadFile, file_content: bytes) -> list:
    """Analyze file content and suggest relevant compliance controls."""
    try:
        # Get available templates/controls from the database
        from database import SessionLocal
        db = SessionLocal()
        
        try:
            # Get all controls from database
            controls = db.query(Control).all()
            logger.info(f"Found {len(controls)} controls in database for analysis")
            
            if not controls:
                logger.warning("No controls found in database - cannot provide AI analysis")
                return []
            
            # Convert to the format expected by our analysis
            available_controls = []
            for control in controls:
                available_controls.append({
                    'code': control.code,
                    'title': control.title,
                    'framework': getattr(control.framework, 'name', 'Unknown') if hasattr(control, 'framework') else 'Unknown',
                    'description': control.description or '',
                })
            
            logger.info(f"Prepared {len(available_controls)} controls for AI analysis")
        finally:
            db.close()
        
        if not available_controls:
            return []
        
        # Extract content based on file type with enhanced detection
        file_text = ""
        filename = file.filename.split('\\')[-1].split('/')[-1]  # Clean filename
        
        # Use python-magic for better file type detection
        try:
            import magic
            file_mime = magic.from_buffer(file_content, mime=True)
        except:
            file_mime = file.content_type
        
        if file_mime == "text/plain" or file.content_type == "text/plain" or filename.lower().endswith(('.txt', '.md', '.csv')):
            try:
                import chardet
                # Detect encoding for better text extraction
                detected = chardet.detect(file_content)
                encoding = detected.get('encoding', 'utf-8')
                file_text = file_content.decode(encoding, errors='ignore')[:2000]  # Limit to first 2000 chars
            except Exception as e:
                try:
                    file_text = file_content.decode('utf-8', errors='ignore')[:2000]
                except:
                    file_text = f"Text file: {filename} (encoding issue)"
                
        elif file_mime == "application/pdf" or file.content_type == "application/pdf" or filename.lower().endswith('.pdf'):
            try:
                import fitz  # PyMuPDF
                import pdfplumber
                
                # Try PyMuPDF first (faster)
                try:
                    pdf_doc = fitz.open(stream=file_content, filetype="pdf")
                    text_pages = []
                    for page_num in range(min(3, pdf_doc.page_count)):  # First 3 pages
                        page = pdf_doc[page_num]
                        page_text = page.get_text()
                        if page_text.strip():
                            text_pages.append(page_text[:800])  # More text per page
                    
                    pdf_doc.close()
                    file_text = " ".join(text_pages)
                except Exception:
                    # Fallback to pdfplumber for more complex PDFs
                    import io
                    with pdfplumber.open(io.BytesIO(file_content)) as pdf:
                        text_pages = []
                        for i, page in enumerate(pdf.pages[:3]):
                            page_text = page.extract_text()
                            if page_text:
                                text_pages.append(page_text[:800])
                        file_text = " ".join(text_pages)
                
                if not file_text.strip():
                    file_text = f"PDF document: {filename} (text extraction failed)"
            except Exception as e:
                logger.warning(f"PDF extraction failed for {filename}: {e}")
                file_text = f"PDF document: {filename} (text extraction failed)"
                
        elif (file_mime and file_mime.startswith("image/")) or file.content_type.startswith("image/") or filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp')):
            # Enhanced image processing with OCR fallback
            try:
                from ai_scanner import get_ai_client
                import base64
                from PIL import Image
                import io
                
                # Process image with PIL first
                try:
                    image = Image.open(io.BytesIO(file_content))
                    # Convert to RGB if needed for better AI analysis
                    if image.mode != 'RGB':
                        image = image.convert('RGB')
                    
                    # Resize if too large (for better AI processing)
                    max_size = (1024, 1024)
                    if image.size[0] > max_size[0] or image.size[1] > max_size[1]:
                        image.thumbnail(max_size, Image.Resampling.LANCZOS)
                        
                        # Convert back to bytes
                        img_buffer = io.BytesIO()
                        image.save(img_buffer, format='JPEG', quality=85)
                        processed_content = img_buffer.getvalue()
                    else:
                        processed_content = file_content
                        
                except Exception:
                    processed_content = file_content
                
                ai_client = get_ai_client()
                image_b64 = base64.b64encode(processed_content).decode('utf-8')
                
                if not isinstance(ai_client, dict):  # OpenAI
                    try:
                        response = ai_client.chat.completions.create(
                            model="gpt-4o",  # Updated to latest vision model
                            messages=[
                                {
                                    "role": "user",
                                    "content": [
                                        {
                                            "type": "text",
                                            "text": f"Analyze this image thoroughly and describe any visible text, error messages, security configurations, system interfaces, compliance-related information, policies, procedures, or other relevant content you can see. Focus on compliance and security aspects. Image: {filename}"
                                        },
                                        {
                                            "type": "image_url",
                                            "image_url": {
                                                "url": f"data:image/jpeg;base64,{image_b64}",
                                                "detail": "high"  # High detail for better text recognition
                                            }
                                        }
                                    ]
                                }
                            ],
                            max_tokens=500
                        )
                        file_text = f"Image analysis: {response.choices[0].message.content}"
                    except Exception as e:
                        logger.warning(f"Vision AI failed for {filename}: {e}")
                        # Fallback to OCR
                        try:
                            import pytesseract
                            from PIL import Image
                            image = Image.open(io.BytesIO(file_content))
                            ocr_text = pytesseract.image_to_string(image)
                            if ocr_text.strip():
                                file_text = f"OCR extracted text from {filename}: {ocr_text[:500]}"
                            else:
                                file_text = f"Screenshot/Image: {filename} (no text detected)"
                        except Exception:
                            file_text = f"Screenshot/Image: {filename}"
                else:
                    # Try OCR for Ollama users
                    try:
                        import pytesseract
                        from PIL import Image
                        image = Image.open(io.BytesIO(file_content))
                        ocr_text = pytesseract.image_to_string(image)
                        if ocr_text.strip():
                            file_text = f"OCR extracted text from {filename}: {ocr_text[:500]}"
                        else:
                            file_text = f"Screenshot/Image: {filename}"
                    except Exception:
                        file_text = f"Image: {filename}"
            except Exception as e:
                logger.error(f"Image processing failed for {filename}: {e}")
                file_text = f"Image: {filename}"
                
        elif file_mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document" or filename.lower().endswith('.docx'):
            # Enhanced Word document processing
            try:
                from docx import Document
                import io
                
                doc = Document(io.BytesIO(file_content))
                paragraphs = []
                for para in doc.paragraphs:
                    if para.text.strip():
                        paragraphs.append(para.text)
                
                # Also extract text from tables
                for table in doc.tables:
                    for row in table.rows:
                        for cell in row.cells:
                            if cell.text.strip():
                                paragraphs.append(cell.text)
                
                file_text = "\n".join(paragraphs[:30])  # First 30 paragraphs/cells
                if not file_text.strip():
                    file_text = f"Word document: {filename} (text extraction failed)"
            except Exception as e:
                logger.warning(f"Word document processing failed for {filename}: {e}")
                file_text = f"Word document: {filename} (text extraction failed)"
                
        elif filename.lower().endswith(('.html', '.htm')):
            # HTML document processing
            try:
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(file_content, 'html.parser')
                # Remove script and style elements
                for script in soup(["script", "style"]):
                    script.decompose()
                file_text = soup.get_text()[:2000]
            except Exception:
                file_text = f"HTML document: {filename}"
                
        elif filename.lower().endswith('.md'):
            # Markdown document processing
            try:
                import markdown
                md_text = file_content.decode('utf-8', errors='ignore')
                html = markdown.markdown(md_text)
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(html, 'html.parser')
                file_text = soup.get_text()[:2000]
            except Exception:
                try:
                    file_text = file_content.decode('utf-8', errors='ignore')[:2000]
                except:
                    file_text = f"Markdown document: {filename}"
        else:
            file_text = f"Document: {filename} (type: {file_mime or file.content_type})"
        
        # Create analysis prompt
        controls_context = "\n".join([
            f"- {c['code']}: {c['title']} ({c['framework']}) - {c['description'][:100]}..."
            for c in available_controls[:10]  # Limit to avoid token limits
        ])
        
        analysis_prompt = f"""
You are a compliance expert. Analyze this document and identify which compliance controls it relates to.

Document: {filename}
Content: {file_text[:1000]}{'...' if len(file_text) > 1000 else ''}

Available compliance controls:
{controls_context}

Analyze the document content and provide the top 3 most relevant controls.
For each control, provide:
- control_code: The exact control code
- control_title: The exact control title  
- framework_name: The framework name
- confidence: A number between 0.0 and 1.0
- reasoning: Brief explanation (1-2 sentences)

Respond ONLY with valid JSON in this exact format:
{{
  "suggestions": [
    {{
      "control_code": "CONTROL_CODE",
      "control_title": "Control Title", 
      "framework_name": "Framework Name",
      "confidence": 0.8,
      "reasoning": "Brief explanation of why this control is relevant."
    }}
  ]
}}

Do not include any text before or after the JSON. Return empty suggestions array if no relevant controls found."""
        
        # Call AI for analysis
        try:
            from ai_scanner import get_ai_client
            logger.info(f"Attempting to get AI client for {filename}")
            ai_client = get_ai_client()
            logger.info(f"AI client initialized: {type(ai_client)}")
            
            if isinstance(ai_client, dict) and ai_client.get('type') == 'ollama':
                import requests
                endpoint = ai_client['endpoint']
                model = ai_client['model']
                logger.info(f"Using Ollama at {endpoint} with model {model}")
                
                # Test Ollama connectivity first
                try:
                    test_response = requests.get(f"{endpoint}/api/tags", timeout=10)
                    logger.info(f"Ollama connectivity test: {test_response.status_code}")
                    if test_response.status_code != 200:
                        logger.error(f"Ollama not reachable at {endpoint}")
                        return generate_fallback_suggestions_from_filename(filename, available_controls)
                except Exception as conn_error:
                    logger.error(f"Cannot connect to Ollama at {endpoint}: {conn_error}")
                    return generate_fallback_suggestions_from_filename(filename, available_controls)
                
                # Simpler prompt for better results
                simple_prompt = f"""Analyze the document '{filename}' and suggest 1 compliance control.

Document content: {file_text[:300] if file_text else 'Filename analysis'}

Available controls: {[c['code'] for c in available_controls[:3]]}

Respond with JSON: {{"suggestions": [{{"control_code": "CODE", "control_title": "Title", "framework_name": "Framework", "confidence": 0.7, "reasoning": "why"}}]}}"""
                
                logger.info(f"Sending prompt to Ollama (length: {len(simple_prompt)})")
                
                response = requests.post(
                    f"{endpoint}/api/generate",
                    json={
                        "model": model,
                        "prompt": simple_prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.3,
                            "num_predict": 300,
                            "stop": ["\n\n", "```"]
                        }
                    },
                    timeout=60
                )
                
                logger.info(f"Ollama response status: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    ai_response = result.get('response', '').strip()
                    logger.info(f"Ollama raw response: '{ai_response[:200]}...'")
                    logger.info(f"Response length: {len(ai_response)}")
                    
                    if not ai_response:
                        logger.warning(f"Ollama returned empty response for {filename}")
                        logger.info(f"Ollama result object: {result}")
                        return generate_fallback_suggestions_from_filename(filename, available_controls)
                else:
                    logger.error(f"Ollama error: {response.status_code} - {response.text[:200]}")
                    return generate_fallback_suggestions_from_filename(filename, available_controls)
            else:
                # OpenAI
                model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
                logger.info(f"Using OpenAI model: {model} for document analysis")
                
                try:
                    # First, test with a simple prompt to verify AI client works
                    logger.info(f"Testing AI connectivity with model: {model}")
                    test_response = create_chat_completion_safe(
                        client=ai_client,
                        model=model,
                        messages=[
                            {"role": "user", "content": "Respond with just the JSON: {\"test\": \"success\"}"}
                        ],
                        max_tokens=50,
                        temperature=0.1
                    )
                    test_content = test_response.choices[0].message.content
                    logger.info(f"AI test response: '{test_content}'")
                    logger.info(f"Test response length: {len(test_content) if test_content else 0}")
                    logger.info(f"Response object: {test_response}")
                    
                    if not test_content or not test_content.strip():
                        logger.error(f"AI test failed - empty response! Usage: {test_response.usage}")
                        logger.error(f"Model used: {test_response.model}")
                        return generate_fallback_suggestions_from_filename(filename, available_controls)
                    
                    # Now try the actual analysis
                    response = create_chat_completion_safe(
                        client=ai_client,
                        model=model,
                        messages=[
                            {"role": "system", "content": "You are a compliance expert. Respond only with valid JSON."},
                            {"role": "user", "content": analysis_prompt[:2000]}  # Limit prompt length
                        ],
                        max_tokens=500,  # Reduced tokens
                        temperature=0.3,
                        use_json_mode=True  # Try JSON mode with fallback
                    )
                    ai_response = response.choices[0].message.content
                    logger.info(f"OpenAI analysis response received, length: {len(ai_response) if ai_response else 0}")
                    
                    if not ai_response:
                        logger.warning(f"OpenAI returned empty response for {filename}")
                        logger.info(f"Prompt length was: {len(analysis_prompt)} characters")
                        logger.info(f"Truncated prompt preview: {analysis_prompt[:200]}...")
                        logger.info(f"Available controls: {len(available_controls)}")
                        if available_controls:
                            logger.info(f"Sample control: {available_controls[0]}")
                        # Try with a much simpler approach
                        simple_prompt = f"Analyze the document '{filename}' and suggest 1 relevant compliance control from this list: {[c['code'] for c in available_controls[:5]]}. Respond with JSON: {{\"suggestions\": [{{\"control_code\": \"X\", \"control_title\": \"Y\", \"framework_name\": \"Z\", \"confidence\": 0.7, \"reasoning\": \"why\"}}]}}"
                        try:
                            simple_response = create_chat_completion_safe(
                                client=ai_client,
                                model=model,
                                messages=[{"role": "user", "content": simple_prompt}],
                                max_tokens=200,
                                temperature=0.3,
                                use_json_mode=True
                            )
                            simple_ai_response = simple_response.choices[0].message.content
                            logger.info(f"Simple prompt response: {simple_ai_response}")
                            if simple_ai_response and simple_ai_response.strip():
                                # Try to parse the simple response
                                try:
                                    simple_parsed = json_module.loads(simple_ai_response)
                                    return simple_parsed.get('suggestions', [])
                                except:
                                    logger.warning("Simple prompt also failed to parse")
                        except Exception as simple_error:
                            logger.error(f"Simple prompt also failed: {simple_error}")
                            return generate_fallback_suggestions_from_filename(filename, available_controls)
                    
                except Exception as openai_error:
                    logger.error(f"OpenAI API error for {filename}: {type(openai_error).__name__}: {openai_error}")
                    
                    # Check for specific error types
                    error_str = str(openai_error).lower()
                    if 'api key' in error_str or 'authentication' in error_str:
                        logger.error("❌ API Key Issue: Check your OpenAI API key in settings")
                    elif 'quota' in error_str or 'billing' in error_str:
                        logger.error("💰 Quota Issue: Check your OpenAI billing/credits")
                    elif 'rate limit' in error_str:
                        logger.error("🚦 Rate Limited: Too many requests to OpenAI")
                    elif 'model' in error_str:
                        logger.error(f"🤖 Model Issue: Model '{model}' might not be available")
                    else:
                        logger.error(f"🔧 Unknown OpenAI Error: {openai_error}")
                    
                    return generate_fallback_suggestions_from_filename(filename, available_controls)
            
            # Parse AI response with improved error handling
            try:
                # Log the raw response for debugging
                logger.info(f"Raw AI response for {filename}: {repr(ai_response[:500])}")
                
                # Check if response looks like an error message
                if ai_response and ("error" in ai_response.lower() or "internal server" in ai_response.lower() or ai_response.startswith("HTTP/")):
                    logger.warning(f"AI response appears to be an error message: {ai_response[:200]}")
                    return generate_fallback_suggestions_from_filename(filename, available_controls)
                
                # Clean the AI response - remove any markdown formatting or extra text
                cleaned_response = ai_response.strip() if ai_response else ""
                
                if not cleaned_response:
                    logger.warning(f"Empty AI response for {filename}")
                    return generate_fallback_suggestions_from_filename(filename, available_controls)
                
                # Look for JSON content within the response
                if '```json' in cleaned_response:
                    # Extract JSON from markdown code blocks
                    start = cleaned_response.find('```json') + 7
                    end = cleaned_response.find('```', start)
                    if end != -1:
                        cleaned_response = cleaned_response[start:end].strip()
                elif '```' in cleaned_response:
                    # Extract from general code blocks
                    start = cleaned_response.find('```') + 3
                    end = cleaned_response.rfind('```')
                    if end != -1 and end > start:
                        cleaned_response = cleaned_response[start:end].strip()
                
                # Find JSON object in the response
                json_start = cleaned_response.find('{')
                json_end = cleaned_response.rfind('}') + 1
                
                if json_start != -1 and json_end > json_start:
                    json_content = cleaned_response[json_start:json_end]
                    try:
                        parsed_response = json_module.loads(json_content)
                    except json_module.JSONDecodeError as json_err:
                        logger.warning(f"JSON parsing failed for extracted content: {json_err}")
                        logger.info(f"Extracted JSON content: {repr(json_content[:300])}")
                        return generate_fallback_suggestions_from_filename(filename, available_controls)
                else:
                    try:
                        parsed_response = json_module.loads(cleaned_response)
                    except json_module.JSONDecodeError as json_err:
                        logger.warning(f"JSON parsing failed for full response: {json_err}")
                        logger.info(f"Cleaned response: {repr(cleaned_response[:300])}")
                        return generate_fallback_suggestions_from_filename(filename, available_controls)
                    
                suggestions = parsed_response.get('suggestions', [])
                
                # Validate and return suggestions
                valid_suggestions = []
                for suggestion in suggestions[:3]:
                    if isinstance(suggestion, dict) and all(key in suggestion for key in ['control_code', 'control_title']):
                        confidence = suggestion.get('confidence', 0.5)
                        # Handle various confidence formats
                        if isinstance(confidence, str):
                            try:
                                confidence = float(confidence.replace('%', '')) / 100 if '%' in confidence else float(confidence)
                            except:
                                confidence = 0.5
                        
                        valid_suggestions.append({
                            'control_code': str(suggestion['control_code']),
                            'control_title': str(suggestion['control_title']),
                            'framework_name': str(suggestion.get('framework_name', 'Unknown')),
                            'confidence': max(0.0, min(1.0, float(confidence))),
                            'reasoning': str(suggestion.get('reasoning', 'AI analysis'))
                        })
                
                return valid_suggestions
                
            except (json_module.JSONDecodeError, ValueError, KeyError) as e:
                logger.warning(f"Failed to parse AI response for {filename}: {str(e)[:100]}")
                logger.info(f"AI response content (first 300 chars): {repr(ai_response[:300])}")
                
                # Check if response is empty or whitespace
                if not ai_response or not ai_response.strip():
                    logger.warning(f"AI returned empty response for {filename}")
                    return generate_fallback_suggestions_from_filename(filename, available_controls)
                
                # Fallback: try to extract control suggestions from free text
                fallback_suggestions = extract_suggestions_from_text(ai_response, available_controls)
                if fallback_suggestions:
                    logger.info(f"Extracted {len(fallback_suggestions)} suggestions from text for {filename}")
                    return fallback_suggestions
                
                # Final fallback to filename analysis
                return generate_fallback_suggestions_from_filename(filename, available_controls)
                
        except Exception as e:
            logger.error(f"AI analysis completely failed for {filename}: {e}")
            # Return smart fallback suggestions based on filename
            return generate_fallback_suggestions_from_filename(filename, available_controls)
            
    except Exception as e:
        logger.error(f"Content analysis error for {file.filename}: {e}")
        logger.exception("Full content analysis error:")
        return []

# Ensure the function always returns a list
async def safe_analyze_file_content_for_controls(file, file_content):
    """Wrapper for analyze_file_content_for_controls that ensures it always returns a list."""
    try:
        result = await analyze_file_content_for_controls(file, file_content)
        if not isinstance(result, list):
            logger.warning(f"analyze_file_content_for_controls returned non-list: {type(result)}")
            return []
        return result
    except Exception as e:
        logger.error(f"Safe analysis wrapper caught error for {file.filename}: {e}")
        return []

def extract_suggestions_from_text(text_response: str, available_controls: list) -> list:
    """Extract control suggestions from free-form AI text when JSON parsing fails."""
    suggestions = []
    text_lower = text_response.lower()
    
    # Look for mentioned control codes in the response
    for control in available_controls[:10]:  # Check first 10 controls
        control_code = control['code'].lower()
        control_title = control['title'].lower()
        
        # Check if control is mentioned in the response
        if (control_code in text_lower or 
            any(word in text_lower for word in control_title.split() if len(word) > 3)):
            
            # Estimate confidence based on how prominently it's mentioned
            confidence = 0.6
            if control_code in text_lower:
                confidence = 0.8
            if 'relevant' in text_lower or 'applicable' in text_lower:
                confidence += 0.1
            if 'not' in text_lower and control_code in text_lower:
                confidence = max(0.3, confidence - 0.3)
                
            suggestions.append({
                'control_code': control['code'],
                'control_title': control['title'],
                'framework_name': control.get('framework', 'Unknown'),
                'confidence': min(0.9, confidence),
                'reasoning': f'AI mentioned this control in analysis text'
            })
            
            if len(suggestions) >= 2:  # Limit fallback suggestions
                break
    
    return suggestions

def generate_fallback_suggestions_from_filename(filename: str, available_controls: list) -> list:
    """Generate basic suggestions based on filename when AI analysis completely fails."""
    suggestions = []
    filename_lower = filename.lower()
    
    # Smart filename analysis - use tuples instead of lists for dictionary keys
    keywords_mapping = {
        ('mfa', 'multi-factor', '2fa', 'authentication', 'auth'): 'authentication',
        ('access', 'identity', 'user', 'login'): 'access',
        ('policy', 'procedure', 'governance'): 'policy', 
        ('security', 'incident', 'response', 'error'): 'security',
        ('config', 'configuration', 'setting'): 'configuration',
        ('log', 'audit', 'monitoring', 'compliance'): 'audit'
    }
    
    for keywords, category in keywords_mapping.items():
        if any(keyword in filename_lower for keyword in keywords):
            # Find matching controls
            for control in available_controls:
                control_lower = (control['title'] + ' ' + control.get('description', '')).lower()
                if (category in control_lower or 
                    any(keyword in control_lower for keyword in keywords[:2])):
                    
                    confidence = 0.6 if category == 'authentication' and 'mfa' in filename_lower else 0.5
                    
                    suggestions.append({
                        'control_code': control['code'],
                        'control_title': control['title'],
                        'framework_name': control.get('framework', 'Unknown'),
                        'confidence': confidence,
                        'reasoning': f'Filename suggests {category}-related content'
                    })
                    
                    if len(suggestions) >= 2:
                        return suggestions
    
    return suggestions

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
        
        # Perform AI content analysis for control suggestions
        suggested_controls = []
        try:
            # Analyze the file content with AI
            await file.seek(0)  # Reset file position
            suggested_controls = await safe_analyze_file_content_for_controls(file, file_content)
            logger.info(f"AI analysis completed for {file.filename}, got {len(suggested_controls)} suggestions")
        except Exception as e:
            logger.error(f"AI content analysis failed for {file.filename}: {e}")
            logger.exception("Full error details:")
            # Continue without control suggestions rather than failing the upload
            suggested_controls = []
        
        return {
            "id": str(document.id),
            "filename": document.filename,
            "mime_type": document.mime_type,
            "file_size": document.file_size,
            "sha256": document.sha256,
            "created_at": document.created_at.isoformat(),
            "download_url": storage.get_download_url(storage_key),
            "suggested_controls": suggested_controls
        }
        
    except Exception as e:
        logger.error(f"Upload failed for {file.filename if file else 'unknown file'}: {e}")
        logger.exception("Full upload error details:")
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
    openai_endpoint: Optional[str] = None
    ollama_endpoint: Optional[str] = 'http://localhost:11434'
    ollama_model: Optional[str] = 'llama2'

@app.get("/settings/ai")
async def get_ai_settings():
    """Get current AI provider settings."""
    return {
        "provider": os.getenv("AI_PROVIDER", "openai"),
        "openai_model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        "openai_endpoint": os.getenv("OPENAI_ENDPOINT"),
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
        if settings.openai_endpoint:
            os.environ["OPENAI_ENDPOINT"] = settings.openai_endpoint
        elif "OPENAI_ENDPOINT" in os.environ:
            # Clear custom endpoint if not specified
            del os.environ["OPENAI_ENDPOINT"]
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
            
            # Use custom endpoint if provided
            base_url = settings.openai_endpoint if settings.openai_endpoint else None
            
            # Only require API key if using default OpenAI endpoint
            if not api_key and not base_url:
                raise HTTPException(status_code=400, detail="OpenAI API key is required for default OpenAI endpoint")
            
            # Use dummy key for custom endpoints that don't require authentication
            if not api_key and base_url:
                api_key = "sk-dummy-key-for-local-api"
            
            client = OpenAI(
                api_key=api_key,
                base_url=base_url
            )
            response = create_chat_completion_safe(
                client=client,
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

@app.get("/settings/openai/models")
async def get_openai_models(endpoint: str = None, api_key: str = None):
    """Get list of available models from OpenAI or custom OpenAI-compatible endpoint."""
    try:
        from openai import OpenAI
        
        # Use provided endpoint or fall back to environment/default
        base_url = endpoint if endpoint else os.getenv("OPENAI_ENDPOINT")
        
        # Use provided API key or fall back to environment
        if not api_key or api_key == "***":
            api_key = os.getenv("OPENAI_API_KEY")
        
        # Only require API key if using default OpenAI endpoint
        if not api_key and not base_url:
            raise HTTPException(status_code=400, detail="OpenAI API key is required for default OpenAI endpoint")
        
        # Use dummy key for custom endpoints that don't require authentication
        if not api_key and base_url:
            api_key = "sk-dummy-key-for-local-api"
        
        # Create client with custom endpoint if provided
        client = OpenAI(
            api_key=api_key,
            base_url=base_url
        )
        
        # Query the /v1/models endpoint
        try:
            logger.info(f"Querying models from endpoint: {base_url or 'https://api.openai.com/v1'}")
            models_response = client.models.list()
            logger.info(f"Models response type: {type(models_response)}")
            
            # Handle case where models_response or data is None
            if not models_response:
                raise HTTPException(status_code=500, detail="No response from models endpoint")
            
            if not hasattr(models_response, 'data'):
                logger.error(f"Models response missing 'data' attribute. Available attributes: {dir(models_response)}")
                raise HTTPException(status_code=500, detail="Invalid response format - missing 'data' field")
            
            if models_response.data is None:
                raise HTTPException(status_code=500, detail="Models endpoint returned null data")
            
            logger.info(f"Models data type: {type(models_response.data)}, length: {len(models_response.data) if models_response.data else 'N/A'}")
            
            models = []
            if models_response.data:
                for i, model in enumerate(models_response.data):
                    logger.info(f"Processing model {i}: {type(model)}")
                    if model and hasattr(model, 'id'):
                        models.append({
                            'id': model.id,
                            'name': model.id,  # For compatibility with frontend
                            'display_name': model.id,
                            'created': getattr(model, 'created', 0),
                            'owned_by': getattr(model, 'owned_by', 'unknown'),
                            'object': getattr(model, 'object', 'model')
                        })
                    else:
                        logger.warning(f"Skipping invalid model at index {i}: {model}")
                    
        except AttributeError as e:
            raise HTTPException(status_code=500, detail=f"Unexpected response format from models endpoint: {str(e)}")
        except Exception as e:
            logger.error(f"OpenAI client models.list() failed: {str(e)}")
            
            # Fallback: try direct HTTP request
            if base_url:
                try:
                    import requests
                    headers = {"Authorization": f"Bearer {api_key}"} if api_key != "sk-dummy-key-for-local-api" else {}
                    models_url = f"{base_url.rstrip('/')}/models"
                    logger.info(f"Trying direct HTTP request to: {models_url}")
                    
                    response = requests.get(models_url, headers=headers, timeout=10)
                    
                    if response.status_code == 200:
                        data = response.json()
                        logger.info(f"Direct HTTP response: {data}")
                        
                        models = []
                        model_list = data.get('data', []) if isinstance(data, dict) else []
                        
                        for model in model_list:
                            if isinstance(model, dict) and 'id' in model:
                                models.append({
                                    'id': model['id'],
                                    'name': model['id'],
                                    'display_name': model['id'],
                                    'created': model.get('created', 0),
                                    'owned_by': model.get('owned_by', 'unknown'),
                                    'object': model.get('object', 'model')
                                })
                        
                        if models:
                            models.sort(key=lambda x: x['name'])
                            return {
                                "models": models,
                                "endpoint": base_url,
                                "total_models": len(models)
                            }
                    
                    logger.error(f"Direct HTTP request failed: {response.status_code} - {response.text}")
                    
                except Exception as fallback_error:
                    logger.error(f"Fallback HTTP request also failed: {fallback_error}")
            
            if "models" in str(e).lower() or "404" in str(e):
                raise HTTPException(status_code=404, detail="Models endpoint not found - may not be OpenAI-compatible")
            else:
                raise HTTPException(status_code=500, detail=f"Error querying models: {str(e)}")
        
        # Sort by name
        models.sort(key=lambda x: x['name'])
        
        return {
            "models": models,
            "endpoint": base_url or "https://api.openai.com/v1",
            "total_models": len(models)
        }
        
    except Exception as e:
        error_msg = str(e).lower()
        if 'api key' in error_msg or 'authentication' in error_msg or 'unauthorized' in error_msg:
            raise HTTPException(status_code=401, detail="Invalid API key or authentication failed")
        elif 'not found' in error_msg or '404' in error_msg:
            raise HTTPException(status_code=404, detail="Models endpoint not found - may not be OpenAI-compatible")
        elif 'connection' in error_msg or 'timeout' in error_msg:
            raise HTTPException(status_code=503, detail="Cannot connect to the endpoint")
        else:
            raise HTTPException(status_code=500, detail=f"Failed to fetch models: {str(e)}")

def create_chat_completion_safe(client, model, messages, max_tokens=None, temperature=None, use_json_mode=False):
    """
    Create a chat completion with safe fallbacks for different endpoint capabilities.
    Some OpenAI-compatible endpoints don't support all features.
    """
    # Base parameters
    params = {
        "model": model,
        "messages": messages
    }
    
    # Add optional parameters
    if max_tokens is not None:
        params["max_tokens"] = max_tokens
    if temperature is not None:
        params["temperature"] = temperature
    
    # Try with JSON mode first if requested
    if use_json_mode:
        try:
            params["response_format"] = {"type": "json_object"}
            return client.chat.completions.create(**params)
        except Exception as e:
            # If JSON mode fails, try without it
            logger.warning(f"JSON mode not supported, falling back to text mode: {e}")
            params.pop("response_format", None)
    
    # Make request without JSON mode
    return client.chat.completions.create(**params)

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

# AI-powered document analysis endpoints
class ControlAnalysisRequest(BaseModel):
    prompt: str
    max_tokens: Optional[int] = 1000
    temperature: Optional[float] = 0.3

@app.post("/ai/analyze-text")
async def analyze_text_with_ai(request: ControlAnalysisRequest):
    """Analyze text using the configured AI provider."""
    try:
        from ai_scanner import get_ai_client
        import json as json_module
        
        ai_client = get_ai_client()
        
        if isinstance(ai_client, dict) and ai_client.get('type') == 'ollama':
            # Handle Ollama
            import requests
            
            endpoint = ai_client['endpoint']
            model = ai_client['model']
            
            response = requests.post(
                f"{endpoint}/api/generate",
                json={
                    "model": model,
                    "prompt": request.prompt,
                    "stream": False,
                    "options": {
                        "temperature": request.temperature,
                        "num_predict": request.max_tokens
                    }
                },
                timeout=60
            )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Ollama API error: {response.status_code} - {response.text}"
                )
            
            result = response.json()
            ai_response = result.get('response', '')
            
        else:
            # Handle OpenAI
            model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
            
            response = create_chat_completion_safe(
                client=ai_client,
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful AI assistant that analyzes documents and provides structured responses."
                    },
                    {
                        "role": "user", 
                        "content": request.prompt
                    }
                ],
                max_tokens=request.max_tokens,
                temperature=request.temperature
            )
            
            ai_response = response.choices[0].message.content
        
        return {"response": ai_response}
        
    except Exception as e:
        logger.error(f"AI analysis failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"AI analysis failed: {str(e)}"
        )

@app.post("/analyze-document-controls")
async def analyze_document_controls(
    file: UploadFile = File(...),
    available_controls: str = None
):
    """Analyze uploaded document and suggest relevant compliance controls."""
    try:
        # Read file content
        file_content = await file.read()
        file_text = ""
        
        # Extract text based on file type
        if file.content_type == "text/plain":
            file_text = file_content.decode('utf-8')
        elif file.content_type == "application/pdf":
            # Extract text from PDF
            try:
                import fitz  # PyMuPDF
                import io
                
                pdf_doc = fitz.open(stream=file_content, filetype="pdf")
                text_pages = []
                for page_num in range(min(3, pdf_doc.page_count)):  # First 3 pages
                    page = pdf_doc[page_num]
                    page_text = page.get_text()
                    if page_text.strip():
                        text_pages.append(f"Page {page_num + 1}: {page_text[:1000]}")
                
                pdf_doc.close()
                file_text = "\n\n".join(text_pages)
                if not file_text.strip():
                    file_text = f"PDF document: {file.filename} (text extraction failed)"
            except Exception as e:
                logger.warning(f"PDF text extraction failed: {e}")
                file_text = f"PDF document: {file.filename} (text extraction failed)"
        
        elif file.content_type.startswith("image/"):
            # Analyze image using AI vision
            try:
                import base64
                
                # Convert image to base64 for AI analysis
                image_b64 = base64.b64encode(file_content).decode('utf-8')
                
                # Use AI to describe the image content
                from ai_scanner import get_ai_client
                ai_client = get_ai_client()
                
                if isinstance(ai_client, dict) and ai_client.get('type') == 'ollama':
                    # Ollama with vision models (if available)
                    try:
                        import requests
                        endpoint = ai_client['endpoint']
                        
                        # Try vision model first
                        vision_response = requests.post(
                            f"{endpoint}/api/generate",
                            json={
                                "model": "llava",  # Vision model
                                "prompt": f"Describe what you see in this image. Focus on any text, security-related content, error messages, configurations, or compliance-related information: {file.filename}",
                                "images": [image_b64],
                                "stream": False
                            },
                            timeout=30
                        )
                        
                        if vision_response.status_code == 200:
                            result = vision_response.json()
                            file_text = f"Image analysis of {file.filename}: {result.get('response', '')}"
                        else:
                            raise Exception("Vision model not available")
                    except:
                        # Fallback to filename analysis
                        file_text = f"Image: {file.filename} (visual analysis not available)"
                        
                else:
                    # OpenAI GPT-4 Vision
                    try:
                        response = ai_client.chat.completions.create(
                            model="gpt-4-vision-preview",
                            messages=[
                                {
                                    "role": "user",
                                    "content": [
                                        {
                                            "type": "text",
                                            "text": f"Analyze this image and describe any text, security configurations, error messages, compliance-related information, or other relevant content you can see. Image filename: {file.filename}"
                                        },
                                        {
                                            "type": "image_url",
                                            "image_url": {
                                                "url": f"data:{file.content_type};base64,{image_b64}"
                                            }
                                        }
                                    ]
                                }
                            ],
                            max_tokens=500
                        )
                        file_text = f"Image analysis of {file.filename}: {response.choices[0].message.content}"
                    except Exception as e:
                        logger.warning(f"Vision analysis failed: {e}")
                        file_text = f"Image: {file.filename} (visual analysis failed)"
                        
            except Exception as e:
                logger.error(f"Image analysis error: {e}")
                file_text = f"Image: {file.filename}"
                
        elif file.content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            # Extract text from Word documents
            try:
                import docx
                import io
                
                doc = docx.Document(io.BytesIO(file_content))
                paragraphs = []
                for para in doc.paragraphs:
                    if para.text.strip():
                        paragraphs.append(para.text)
                
                file_text = "\n".join(paragraphs[:20])  # First 20 paragraphs
                if not file_text.strip():
                    file_text = f"Word document: {file.filename} (text extraction failed)"
            except Exception as e:
                logger.warning(f"Word document text extraction failed: {e}")
                file_text = f"Word document: {file.filename} (text extraction failed)"
                
        else:
            # For other file types, use filename
            file_text = f"Document: {file.filename}"
        
        # Parse available controls
        controls = []
        if available_controls:
            try:
                controls = json_module.loads(available_controls)
            except:
                pass
        
        if not controls:
            return {"suggested_controls": []}
        
        # Create analysis prompt
        controls_context = "\n".join([
            f"- {c.get('code', 'N/A')}: {c.get('title', 'N/A')} ({c.get('framework', 'N/A')}) - {c.get('description', 'N/A')[:100]}..."
            for c in controls[:10]  # Limit to first 10 controls to avoid token limits
        ])
        
        analysis_prompt = f"""
Analyze this document and determine which compliance controls it might relate to:

Document: {file.filename}
Content preview: {file_text[:500]}{'...' if len(file_text) > 500 else ''}

Available compliance controls:
{controls_context}

For each relevant control, provide a confidence score (0.0-1.0) and brief reasoning.
Respond in JSON format with a "suggestions" array containing objects with:
- control_code: the control code
- control_title: the control title  
- framework_name: the framework name
- confidence: score from 0.0 to 1.0
- reasoning: brief explanation

Limit to the top 3 most relevant matches. If no relevant matches, return empty array.
"""
        
        # Call AI analysis
        from ai_scanner import get_ai_client
        
        ai_client = get_ai_client()
        
        if isinstance(ai_client, dict) and ai_client.get('type') == 'ollama':
            # Handle Ollama
            import requests
            
            endpoint = ai_client['endpoint']
            model = ai_client['model']
            
            response = requests.post(
                f"{endpoint}/api/generate",
                json={
                    "model": model,
                    "prompt": analysis_prompt + "\n\nRespond only with valid JSON.",
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 500
                    }
                },
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                ai_response = result.get('response', '')
            else:
                raise Exception(f"Ollama error: {response.status_code}")
                
        else:
            # Handle OpenAI
            model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
            
            response = create_chat_completion_safe(
                client=ai_client,
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a compliance expert that analyzes documents and suggests relevant compliance controls. Respond only with valid JSON."
                    },
                    {
                        "role": "user", 
                        "content": analysis_prompt
                    }
                ],
                max_tokens=800,
                temperature=0.3,
                use_json_mode=True
            )
            
            ai_response = response.choices[0].message.content
        
        # Parse AI response
        try:
            parsed_response = json_module.loads(ai_response)
            suggestions = parsed_response.get('suggestions', [])
            
            # Validate and clean suggestions
            valid_suggestions = []
            for suggestion in suggestions[:3]:  # Limit to top 3
                if all(key in suggestion for key in ['control_code', 'control_title', 'confidence', 'reasoning']):
                    # Ensure confidence is between 0 and 1
                    confidence = max(0.0, min(1.0, float(suggestion.get('confidence', 0))))
                    valid_suggestions.append({
                        'control_code': str(suggestion['control_code']),
                        'control_title': str(suggestion['control_title']),
                        'framework_name': str(suggestion.get('framework_name', 'Unknown')),
                        'confidence': confidence,
                        'reasoning': str(suggestion['reasoning'])
                    })
            
            return {"suggested_controls": valid_suggestions}
            
        except json_module.JSONDecodeError:
            logger.warning(f"Failed to parse AI response as JSON: {ai_response[:200]}...")
            return {"suggested_controls": []}
        
    except Exception as e:
        logger.error(f"Document control analysis failed: {e}")
        # Return empty suggestions on error rather than failing  
        return {"suggested_controls": []}
        
    finally:
        # Reset file position for any subsequent reads
        await file.seek(0)