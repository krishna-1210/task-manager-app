"""Authentication business logic: password hashing, JWT, and in-memory lockout.

This module is the single source of truth for all auth operations.
It has no HTTP concerns — it raises HTTPException only to signal auth failures
that the router layer propagates directly to the client.
"""

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

from fastapi import HTTPException
from jose import ExpiredSignatureError, JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# bcrypt cost factor — must be ≤ 12 to satisfy the 500ms login SLA (Requirement 1.3)
BCRYPT_ROUNDS: int = 12

# JWT algorithm
JWT_ALGORITHM: str = "HS256"

# Token lifetime in seconds (1 hour — Requirement 1.1)
ACCESS_TOKEN_EXPIRE_SECONDS: int = 3600

# Lockout policy constants (Requirements 1.6, 1.7)
MAX_FAILURES_BEFORE_LOCKOUT: int = 5
FAILURE_WINDOW_SECONDS: float = 600.0   # 10 minutes
LOCKOUT_DURATION_SECONDS: float = 900.0  # 15 minutes

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=BCRYPT_ROUNDS)


def hash_password(plain_password: str) -> str:
    """Hash a plain-text password using bcrypt.

    Args:
        plain_password: The raw password string supplied by the user.

    Returns:
        A bcrypt hash string suitable for storage.
    """
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a stored bcrypt hash.

    Args:
        plain_password: The raw password string supplied by the user.
        hashed_password: The bcrypt hash retrieved from the database.

    Returns:
        True if the password matches, False otherwise.
    """
    return _pwd_context.verify(plain_password, hashed_password)


# ---------------------------------------------------------------------------
# JWT issuance and decoding
# ---------------------------------------------------------------------------


def create_access_token(user_id: int) -> str:
    """Issue a signed JWT for the given user ID with a 1-hour expiry.

    Args:
        user_id: The authenticated user's database primary key.

    Returns:
        A signed JWT string.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now.timestamp() + ACCESS_TOKEN_EXPIRE_SECONDS,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT, returning the payload dict.

    Args:
        token: The raw Bearer token string from the Authorization header.

    Returns:
        The decoded JWT payload dict (contains at minimum ``sub`` and ``exp``).

    Raises:
        HTTPException(401): If the token is expired, malformed, or has an
            invalid signature.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except ExpiredSignatureError:
        logger.warning("JWT decode failed: token has expired.")
        raise HTTPException(status_code=401, detail="Token has expired")
    except JWTError as exc:
        logger.warning("JWT decode failed: %s", exc)
        raise HTTPException(status_code=401, detail="Not authenticated")


# ---------------------------------------------------------------------------
# In-memory lockout store
# ---------------------------------------------------------------------------


@dataclass
class LockoutRecord:
    """Per-account failure tracking for the in-memory lockout store.

    Attributes:
        consecutive_failures: Number of consecutive failed login attempts
            within the current failure window.
        window_start: monotonic timestamp (seconds) when the current failure
            window began.
        locked_until: monotonic timestamp (seconds) after which the account
            is unlocked, or None if the account is not locked.
    """

    consecutive_failures: int = 0
    window_start: float = field(default_factory=time.monotonic)
    locked_until: float | None = None


# Keyed by username. Lives in process memory — does not survive restarts.
_lockout_store: dict[str, LockoutRecord] = {}


def check_lockout(username: str) -> None:
    """Raise HTTP 429 if the account is currently locked out.

    Per Requirement 1.7, if the account IS locked but the caller supplies
    valid credentials, the router layer is responsible for calling
    ``clear_lockout`` and returning a token instead of propagating the 429.
    This function only raises; it does not check credentials.

    Args:
        username: The username being authenticated.

    Raises:
        HTTPException(429): If the account is locked and the lockout period
            has not yet expired.
    """
    record = _lockout_store.get(username)
    if record is None or record.locked_until is None:
        return

    remaining = record.locked_until - time.monotonic()
    if remaining > 0:
        minutes_remaining = max(1, int(remaining // 60) + 1)
        logger.warning("Login blocked — account '%s' locked for %d more minute(s).", username, minutes_remaining)
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in {minutes_remaining} minute(s).",
        )

    # Lockout has expired naturally — clean up
    del _lockout_store[username]


def record_failure(username: str) -> None:
    """Record a failed login attempt and apply lockout if threshold is reached.

    Resets the failure window if the last failure was more than
    ``FAILURE_WINDOW_SECONDS`` ago. Locks the account for
    ``LOCKOUT_DURATION_SECONDS`` when ``consecutive_failures`` reaches
    ``MAX_FAILURES_BEFORE_LOCKOUT``.

    Args:
        username: The username that failed authentication.
    """
    now = time.monotonic()
    record = _lockout_store.get(username)

    if record is None:
        _lockout_store[username] = LockoutRecord(consecutive_failures=1, window_start=now)
        return

    # Reset window if it has expired
    if now - record.window_start > FAILURE_WINDOW_SECONDS:
        record.consecutive_failures = 1
        record.window_start = now
        record.locked_until = None
    else:
        record.consecutive_failures += 1

    if record.consecutive_failures >= MAX_FAILURES_BEFORE_LOCKOUT:
        record.locked_until = now + LOCKOUT_DURATION_SECONDS
        logger.warning(
            "Account '%s' locked after %d consecutive failures.",
            username,
            record.consecutive_failures,
        )


def clear_lockout(username: str) -> None:
    """Remove the lockout record for an account after a successful login.

    Args:
        username: The username that authenticated successfully.
    """
    _lockout_store.pop(username, None)
