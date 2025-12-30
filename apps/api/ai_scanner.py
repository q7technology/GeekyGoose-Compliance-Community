"""
AI-powered compliance scanning using OpenAI GPT models.
Analyzes evidence documents against compliance requirements.
"""
import json
import logging
import os
from typing import List, Dict, Any, Optional
from openai import OpenAI
from pydantic import BaseModel, Field
from models import Control, Requirement

logger = logging.getLogger(__name__)

def create_chat_completion_safe(client, model, messages, temperature=None):
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
    if temperature is not None:
        params["temperature"] = temperature
    
    # Make request - LM Studio and similar don't support JSON mode
    return client.chat.completions.create(**params)

# Initialize OpenAI client lazily
client = None

def get_ai_client():
    """Get AI client based on configured provider."""
    provider = os.getenv('AI_PROVIDER', 'openai')
    
    if provider == 'openai':
        api_key = os.getenv('OPENAI_API_KEY')
        base_url = os.getenv('OPENAI_ENDPOINT')
        
        # Only require API key if using default OpenAI endpoint
        if (not api_key or api_key == 'your_openai_api_key_here') and not base_url:
            raise ValueError("OPENAI_API_KEY not configured. Please set a valid OpenAI API key for default OpenAI endpoint.")
        
        # Use dummy key for custom endpoints that don't require authentication
        if (not api_key or api_key == 'your_openai_api_key_here') and base_url:
            api_key = "sk-dummy-key-for-local-api"
        
        try:
            from openai import OpenAI
            return OpenAI(api_key=api_key, base_url=base_url)
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")
            raise
    elif provider == 'ollama':
        try:
            import requests
            endpoint = os.getenv('OLLAMA_ENDPOINT', 'http://localhost:11434')
            model = os.getenv('OLLAMA_MODEL', 'llama2')
            
            # Test connection
            response = requests.get(f"{endpoint}/api/tags", timeout=5)
            if response.status_code != 200:
                raise ValueError(f"Cannot connect to Ollama at {endpoint}")
                
            return {'endpoint': endpoint, 'model': model, 'type': 'ollama'}
        except Exception as e:
            logger.error(f"Failed to initialize Ollama client: {e}")
            raise
    else:
        raise ValueError(f"Unknown AI provider: {provider}")

def get_openai_client():
    """Legacy function for backward compatibility."""
    return get_ai_client()

class Citation(BaseModel):
    """Citation reference to evidence in documents."""
    document_id: str = Field(description="ID of the document containing the evidence")
    document_name: str = Field(description="Name of the document")
    page_num: int = Field(description="Page number where evidence was found")
    quote: str = Field(description="Direct quote from the document (max 30 words)")

class RequirementResult(BaseModel):
    """Result of scanning a single requirement."""
    requirement_id: str = Field(description="ID of the requirement being evaluated")
    outcome: str = Field(description="PASS, PARTIAL, FAIL, or NOT_FOUND")
    confidence: float = Field(description="Confidence score between 0.0 and 1.0")
    rationale: str = Field(description="Explanation of the outcome")
    citations: List[Citation] = Field(description="Evidence citations supporting this outcome")

class RecommendedAction(BaseModel):
    """Recommended action to address a compliance gap."""
    title: str = Field(description="Short title of the recommended action")
    detail: str = Field(description="Detailed description of what needs to be done")
    priority: str = Field(description="HIGH, MEDIUM, or LOW priority")

class Gap(BaseModel):
    """Compliance gap identified during scanning."""
    requirement_id: str = Field(description="ID of the requirement with gaps")
    summary: str = Field(description="Brief summary of what is missing")
    recommended_actions: List[RecommendedAction] = Field(description="Actions to address this gap")

class ScanResponse(BaseModel):
    """Complete response from compliance scanning."""
    requirements: List[RequirementResult] = Field(description="Results for each requirement")
    gaps: List[Gap] = Field(description="Identified compliance gaps")

class ComplianceScanner:
    """
    AI-powered compliance scanner that analyzes evidence against requirements.
    """
    
    def __init__(self, model: str = "gpt-4"):
        self.model = model
        self.prompt_version = "v1.0"
    
    def scan_control(self, control: Control, requirements: List[Requirement], 
                    evidence_texts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Scan a compliance control against provided evidence.
        
        Args:
            control: The control being evaluated
            requirements: List of requirements for the control
            evidence_texts: List of evidence text excerpts with metadata
            
        Returns:
            Dictionary with requirements results and gaps
        """
        try:
            # Build the prompt
            prompt = self._build_scan_prompt(control, requirements, evidence_texts)
            
            logger.info(f"Starting AI scan for control {control.code} with {len(requirements)} requirements")
            
            # Call AI provider (OpenAI or Ollama)
            ai_client = get_ai_client()
            
            if isinstance(ai_client, dict) and ai_client.get('type') == 'ollama':
                # Handle Ollama
                response = self._call_ollama(ai_client, prompt)
            else:
                # Handle OpenAI - use standard chat completions with JSON
                response = create_chat_completion_safe(
                    client=ai_client,
                    model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a compliance expert that analyzes evidence documents against security control requirements. You must respond with valid JSON only."
                        },
                        {
                            "role": "user", 
                            "content": prompt + "\n\nRespond with valid JSON only following the exact schema provided."
                        }
                    ],
                    temperature=0.1  # Low temperature for consistent results
                )
            
            # Parse the structured response
            if isinstance(ai_client, dict) and ai_client.get('type') == 'ollama':
                scan_result = response  # Already parsed for Ollama
            else:
                # Parse OpenAI JSON response
                try:
                    response_text = response.choices[0].message.content.strip()
                    json_data = json.loads(response_text)
                    scan_result = ScanResponse(**json_data)
                except (json.JSONDecodeError, Exception) as e:
                    logger.error(f"Failed to parse OpenAI response: {e}")
                    # Return empty result on parse failure
                    scan_result = ScanResponse(requirements=[], gaps=[])
            
            # Convert to dictionary format expected by worker
            result_dict = {
                "requirements": [],
                "gaps": []
            }
            
            for req_result in scan_result.requirements:
                result_dict["requirements"].append({
                    "requirement_id": req_result.requirement_id,
                    "outcome": req_result.outcome,
                    "confidence": req_result.confidence,
                    "rationale": req_result.rationale,
                    "citations": [
                        {
                            "document_id": c.document_id,
                            "document_name": c.document_name,
                            "page_num": c.page_num,
                            "quote": c.quote
                        }
                        for c in req_result.citations
                    ]
                })
            
            for gap in scan_result.gaps:
                result_dict["gaps"].append({
                    "requirement_id": gap.requirement_id,
                    "summary": gap.summary,
                    "recommended_actions": [
                        {
                            "title": a.title,
                            "detail": a.detail,
                            "priority": a.priority
                        }
                        for a in gap.recommended_actions
                    ]
                })
            
            logger.info(f"AI scan completed for control {control.code}")
            return result_dict
            
        except Exception as e:
            logger.error(f"Error during AI scan: {str(e)}")
            # Return empty results on failure
            return {
                "requirements": [],
                "gaps": []
            }
    
    def _build_scan_prompt(self, control: Control, requirements: List[Requirement], 
                          evidence_texts: List[Dict[str, Any]]) -> str:
        """
        Build the prompt for AI scanning.
        """
        prompt = f"""
COMPLIANCE SCANNING TASK

You are analyzing evidence documents to determine compliance with the security control "{control.code}: {control.title}".

CONTROL DESCRIPTION:
{control.description}

REQUIREMENTS TO EVALUATE:
"""
        
        # Add requirements
        for req in requirements:
            prompt += f"\nRequirement ID: {req.id}"
            prompt += f"\n{req.req_code}: {req.text}"
            if req.guidance:
                prompt += f"\n  Guidance: {req.guidance}"
            prompt += f"\n  Maturity Level: {req.maturity_level}"
            prompt += "\n"
        
        # Add evidence
        prompt += "\nEVIDENCE DOCUMENTS:\n"
        
        for i, evidence in enumerate(evidence_texts):
            prompt += f"\nDocument {i+1}: {evidence['document_name']} (Page {evidence['page_num']})\n"
            # Truncate very long evidence to avoid token limits
            text = evidence['text']
            if len(text) > 2000:
                text = text[:2000] + "... [truncated]"
            prompt += f"Content: {text}\n"
        
        # Add instructions
        prompt += """
ANALYSIS INSTRUCTIONS:

1. For each requirement, analyze the evidence and determine:
   - OUTCOME: PASS (fully satisfies), PARTIAL (partially satisfies), FAIL (contradicts), or NOT_FOUND (no evidence)
   - CONFIDENCE: 0.0 to 1.0 based on strength and clarity of evidence
   - RATIONALE: Clear explanation of your assessment
   - CITATIONS: Direct quotes from evidence (max 30 words each)

2. For any requirement that is PARTIAL, FAIL, or NOT_FOUND, identify gaps and recommend specific actions.

3. Be conservative: if evidence is unclear or ambiguous, use lower confidence scores.

4. Never hallucinate - only cite evidence that actually exists in the provided documents.

5. Focus on concrete evidence like policies, procedures, configurations, and screenshots.

You must respond with valid JSON only, following this exact schema:
{
  "requirements": [
    {
      "requirement_id": "string (use the UUID Requirement ID provided above)",
      "outcome": "PASS|PARTIAL|FAIL|NOT_FOUND", 
      "confidence": 0.0-1.0,
      "rationale": "string explanation",
      "citations": [{"document_id": "string", "document_name": "string", "page_num": 1, "quote": "string max 30 words"}]
    }
  ],
  "gaps": [
    {
      "requirement_id": "string",
      "summary": "string describing what is missing", 
      "recommended_actions": [{"title": "string", "detail": "string", "priority": "HIGH|MEDIUM|LOW"}]
    }
  ]
}
"""
        
        return prompt

    def _call_ollama(self, client_config: Dict, prompt: str) -> ScanResponse:
        """Call Ollama API and parse response."""
        import requests
        import json
        
        endpoint = client_config['endpoint']
        model = client_config['model']
        
        # Add JSON schema instruction to prompt
        json_prompt = prompt + """

You must respond with valid JSON only, following this exact schema:
{
  "requirements": [
    {
      "requirement_id": "string",
      "outcome": "PASS|PARTIAL|FAIL|NOT_FOUND", 
      "confidence": 0.0-1.0,
      "rationale": "string explanation",
      "citations": [{"document_id": "string", "document_name": "string", "page_num": 1, "quote": "string"}]
    }
  ],
  "gaps": [
    {
      "requirement_id": "string",
      "summary": "string", 
      "recommended_actions": [{"title": "string", "detail": "string", "priority": "HIGH|MEDIUM|LOW"}]
    }
  ]
}

Respond only with valid JSON. No additional text."""

        try:
            response = requests.post(
                f"{endpoint}/api/generate",
                json={
                    "model": model,
                    "prompt": json_prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,
                        "top_p": 0.9
                    }
                },
                timeout=120  # Longer timeout for complex analysis
            )
            
            if response.status_code != 200:
                raise Exception(f"Ollama API error: {response.status_code} - {response.text}")
            
            result = response.json()
            response_text = result.get('response', '').strip()
            
            # Try to parse JSON response
            try:
                json_data = json.loads(response_text)
                return ScanResponse(**json_data)
            except json.JSONDecodeError:
                # If JSON parsing fails, create a fallback response
                logger.warning(f"Failed to parse Ollama JSON response: {response_text[:200]}...")
                return ScanResponse(
                    requirements=[],
                    gaps=[{
                        "requirement_id": "unknown",
                        "summary": "Failed to parse AI response - please try again",
                        "recommended_actions": [{
                            "title": "Retry Analysis",
                            "detail": "The AI response could not be parsed. Try running the scan again.",
                            "priority": "MEDIUM"
                        }]
                    }]
                )
                
        except Exception as e:
            logger.error(f"Ollama API call failed: {e}")
            raise

# Global scanner instance
compliance_scanner = ComplianceScanner()