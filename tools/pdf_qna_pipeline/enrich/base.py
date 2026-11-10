"""Abstract interface for question and option enrichment (OCR, Vision, LaTeX)."""

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional


class BaseEnricher(ABC):
    """Abstract interface for image-to-text / image-to-LaTeX enrichment."""

    @abstractmethod
    def enrich_image(self, image_path: Path) -> str:
        """
        Convert an image of a question statement or option into text/LaTeX.
        Returns extracted text, or empty string if enrichment is not performed.
        """
        pass
