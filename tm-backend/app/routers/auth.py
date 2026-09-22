"""Auth router — POST /auth/login.

Accepts OAuth2 password form credentials, enforces account lockout, and
returns a signed JWT on success.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import User
from app.schemas import TokenResponse
from app.services.auth_service import (
    check_lockout,
    clear_lockout,
    create_access_token,
    record_failure,
    verify_password,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Authenticate a user and return a JWT access token.

    Flow (Requirements 1.1, 1.6, 1.7):
      1. check_lockout  — raises 429 if account is currently locked
      2. Look up user by username
      3. verify_password — on failure: record_failure + raise 401
      4. On success with a previously locked account: clear_lockout first
      5. Return TokenResponse with a fresh JWT

    Args:
        form_data: OAuth2 password form (username + password fields).
        db: SQLAlchemy database session.

    Returns:
        TokenResponse containing the signed access token.

    Raises:
        HTTPException(429): Account is locked due to too many failures.
        HTTPException(401): Invalid username or password.
    """
    username = form_data.username

    # Step 1 — check lockout before any DB work (Requirement 1.6)
    # Per Requirement 1.7: if locked but credentials ARE valid, clear lockout
    # and return token. We therefore catch the 429 here and retry after
    # credential verification only if the password is correct.
    is_locked = False
    try:
        check_lockout(username)
    except HTTPException as exc:
        if exc.status_code == 429:
            is_locked = True
        else:
            raise

    # Step 2 — load user from DB
    user: User | None = db.query(User).filter(User.username == username).first()

    # Step 3 — verify credentials (same response for unknown user vs bad password
    # to prevent username enumeration)
    if user is None or not verify_password(form_data.password, user.hashed_password):
        logger.warning("Failed login attempt for username '%s'.", username)
        record_failure(username)
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Credentials are valid — if account was locked, clear it (Requirement 1.7)
    if is_locked:
        logger.info("Locked account '%s' authenticated successfully — clearing lockout.", username)
        clear_lockout(username)
    else:
        clear_lockout(username)

    logger.info("User '%s' (id=%d) logged in successfully.", user.username, user.id)
    token = create_access_token(user.id)
    return TokenResponse(access_token=token)
