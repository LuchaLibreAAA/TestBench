"""Admin token dependency for write endpoints."""

import secrets
from fastapi import Header, HTTPException, Request


def require_admin(request: Request, x_admin_token: str | None = Header(None)) -> None:
    """Require configured admin credentials, allowing a fixed local dev token only by opt-in."""
    settings = request.app.state.settings
    expected = settings.admin_token or ("dev" if settings.allow_insecure_dev else "")
    if not expected or not x_admin_token or not secrets.compare_digest(expected, x_admin_token):
        raise HTTPException(status_code=401, detail="Admin authentication required")
