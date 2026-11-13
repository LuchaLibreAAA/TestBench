"""Meta endpoint providing API contract, capability flags, and server time."""

from datetime import datetime, timezone
from fastapi import APIRouter
from backend.app.models.api_models import MetaResponse

router = APIRouter(prefix="/meta", tags=["Meta"])


@router.get("", response_model=MetaResponse)
def get_metadata():
    """Return API version, supported client constraints, and feature flags."""
    now_utc = datetime.now(timezone.utc).isoformat()
    return MetaResponse(
        apiVersion="v1",
        supportedSchemaVersions=["1.0", "1"],
        minSupportedClient={"web": "0.0.2", "android": "1.0.0"},
        features=[
            "single_choice",
            "multi_choice",
            "numeric",
            "true_false",
            "content_blocks",
            "offline_packages",
            "webp_variants",
        ],
        serverTime=now_utc,
    )
