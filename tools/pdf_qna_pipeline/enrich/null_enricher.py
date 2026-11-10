"""Default no-op enricher returning empty string."""

from pathlib import Path
from tools.pdf_qna_pipeline.enrich.base import BaseEnricher


class NullEnricher(BaseEnricher):
    """Default enricher that leaves text empty without failing."""

    def enrich_image(self, image_path: Path) -> str:
        """Returns empty string for any image."""
        return ""
