"""Shared FastAPI Depends() helpers.

get_current_user is fully implemented in Task 5.2.
This stub ensures downstream modules can import it without errors.
"""

import logging

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db.database import get_db

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """Extract and validate the Bearer token, returning the authenticated User.

    Full implementation added in Task 5.2 (auth service + JWT decoding).
    Raises HTTPException(401) for missing, malformed, or expired tokens.
    """
    # Placeholder — raises 401 until Task 5.2 is implemented
    raise HTTPException(status_code=401, detail="Not authenticated")
