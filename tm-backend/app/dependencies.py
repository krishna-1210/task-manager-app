"""Shared FastAPI Depends() helpers."""

import logging

from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import User
from app.services.auth_service import decode_token

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Extract and validate the Bearer token, returning the authenticated User.

    Flow:
      1. Decode and validate the JWT via decode_token (raises 401 on bad token).
      2. Extract user ID from the ``sub`` claim.
      3. Load the User row from the database.
      4. Raise 401 if the user no longer exists.

    Args:
        token: Raw Bearer token from the Authorization header.
        db: SQLAlchemy database session.

    Returns:
        The authenticated User ORM instance.

    Raises:
        HTTPException(401): Token is invalid, expired, or user not found.
    """
    # decode_token raises HTTPException(401) on any JWT problem
    payload = decode_token(token)

    user_id_str: str | None = payload.get("sub")
    if not user_id_str:
        logger.warning("JWT payload missing 'sub' claim.")
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        user_id = int(user_id_str)
    except ValueError:
        logger.warning("JWT 'sub' claim is not a valid integer: %s", user_id_str)
        raise HTTPException(status_code=401, detail="Not authenticated")

    user: User | None = db.query(User).filter(User.id == user_id).first()
    if user is None:
        logger.warning("JWT references non-existent user id=%d.", user_id)
        raise HTTPException(status_code=401, detail="Not authenticated")

    return user
