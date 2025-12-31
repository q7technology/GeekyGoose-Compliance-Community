"""
Error handling and security middleware for the GeekyGoose Compliance API.
"""
import logging
import time
from typing import Callable
from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from pydantic import ValidationError

logger = logging.getLogger(__name__)


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """
    Centralized error handling middleware to provide consistent error responses
    and prevent sensitive information leakage.
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            # Add request timing
            start_time = time.time()
            response = await call_next(request)
            process_time = time.time() - start_time
            response.headers["X-Process-Time"] = str(process_time)
            return response
            
        except ValidationError as e:
            logger.warning(f"Validation error for {request.url}: {e}")
            return JSONResponse(
                status_code=422,
                content={
                    "error": "Validation Error",
                    "message": "Request data validation failed",
                    "details": [{"field": err["loc"][-1], "message": err["msg"]} for err in e.errors()]
                }
            )
            
        except IntegrityError as e:
            logger.warning(f"Database integrity error for {request.url}: {e}")
            return JSONResponse(
                status_code=409,
                content={
                    "error": "Data Conflict",
                    "message": "The operation conflicts with existing data"
                }
            )
            
        except SQLAlchemyError as e:
            logger.error(f"Database error for {request.url}: {e}")
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Database Error",
                    "message": "An internal database error occurred"
                }
            )
            
        except HTTPException as e:
            # Re-raise HTTP exceptions to let FastAPI handle them
            raise e
            
        except FileNotFoundError as e:
            logger.error(f"File not found for {request.url}: {e}")
            return JSONResponse(
                status_code=404,
                content={
                    "error": "File Not Found",
                    "message": "The requested file could not be found"
                }
            )
            
        except PermissionError as e:
            logger.error(f"Permission error for {request.url}: {e}")
            return JSONResponse(
                status_code=403,
                content={
                    "error": "Permission Denied",
                    "message": "You don't have permission to access this resource"
                }
            )
            
        except Exception as e:
            # Log the full error for debugging, but return generic message to client
            logger.error(f"Unexpected error for {request.url}: {type(e).__name__}: {e}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Internal Server Error",
                    "message": "An unexpected error occurred. Please try again later."
                }
            )


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds security headers to all responses.
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        
        return response


class RequestValidationMiddleware(BaseHTTPMiddleware):
    """
    Validates request size and content type for security.
    """
    
    MAX_REQUEST_SIZE = 50 * 1024 * 1024  # 50MB max request size
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Check request size
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.MAX_REQUEST_SIZE:
            logger.warning(f"Request size too large: {content_length} bytes from {request.client.host}")
            return JSONResponse(
                status_code=413,
                content={
                    "error": "Request Too Large",
                    "message": f"Request size exceeds maximum allowed size of {self.MAX_REQUEST_SIZE} bytes"
                }
            )
        
        # Validate file upload content types
        if request.url.path.startswith("/api/documents") and request.method == "POST":
            content_type = request.headers.get("content-type", "")
            if content_type.startswith("multipart/form-data"):
                # Additional validation can be added here for file uploads
                pass
        
        return await call_next(request)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Logs all API requests for monitoring and security.
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        # Log request
        logger.info(f"{request.method} {request.url.path} - Client: {request.client.host if request.client else 'unknown'}")
        
        response = await call_next(request)
        
        # Log response
        process_time = time.time() - start_time
        logger.info(f"{request.method} {request.url.path} - Status: {response.status_code} - Time: {process_time:.3f}s")
        
        return response


# Exception classes for better error handling
class BusinessLogicError(Exception):
    """Raised when business logic validation fails."""
    pass


class AIProcessingError(Exception):
    """Raised when AI processing fails."""
    pass


class FileProcessingError(Exception):
    """Raised when file processing fails."""
    pass


class AuthenticationError(Exception):
    """Raised when authentication fails."""
    pass


class AuthorizationError(Exception):
    """Raised when user lacks required permissions."""
    pass