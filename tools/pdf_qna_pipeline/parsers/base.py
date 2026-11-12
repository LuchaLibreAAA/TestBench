"""Abstract base class for PDF exam parsers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Any, Dict
import pymupdf


@dataclass
class PageRegion:
    """A region on a specific PDF page."""
    page: int  # 0-indexed page index
    bbox: Tuple[float, float, float, float]  # (x0, y0, x1, y1)
    xref: int = 0  # 0 if inline or rendered clip, > 0 if XObject


@dataclass
class ParsedOption:
    """Parsed option metadata and bounding box."""
    option_number: int
    option_id: str
    label: str  # "a", "b", "c", "d"
    page: int
    label_bbox: Tuple[float, float, float, float]
    image_region: Optional[PageRegion] = None
    text: str = ""


@dataclass
class ParsedQuestion:
    """Parsed question structure before image clipping and export."""
    question_number: int
    question_id: str
    question_type: str  # "single_choice" or "numeric"
    section_id: str
    subject: str
    source_pages: List[int]
    header_bbox: Tuple[float, float, float, float]
    statement_images: List[PageRegion] = field(default_factory=list)
    options: List[ParsedOption] = field(default_factory=list)
    text: str = ""


@dataclass
class ParsedPaper:
    """Complete parsed paper containing all questions and metadata."""
    exam_name: str
    total_questions: int
    questions: List[ParsedQuestion]
    raw_metadata: Dict[str, Any] = field(default_factory=dict)
    sanitized_doc: Optional[pymupdf.Document] = None


class BaseParser(ABC):
    """Abstract interface for PDF exam parsers."""

    @abstractmethod
    def parse(self, doc: pymupdf.Document) -> ParsedPaper:
        """Parse a PDF document into structured ParsedPaper."""
        pass
