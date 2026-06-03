# src/exceptions.py
"""Custom exceptions for the application."""

from typing import Optional


class SessionNotFoundError(Exception):
    """Raised when a requested session is not found."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        super().__init__(f"Session '{session_id}' not found")


class InvalidFileUploadError(Exception):
    """Raised when a file upload fails validation."""

    def __init__(self, message: str, filename: Optional[str] = None):
        self.filename = filename
        self.message = message
        super().__init__(message)


class LLMServiceError(Exception):
    """Raised when there is an error communicating with the LLM service."""

    def __init__(self, message: str, endpoint: Optional[str] = None):
        self.endpoint = endpoint
        self.message = message
        super().__init__(message)


class WebSearchError(Exception):
    """Raised when there is an error with web search functionality."""

    def __init__(self, message: str, query: Optional[str] = None):
        self.query = query
        self.message = message
        super().__init__(message)
