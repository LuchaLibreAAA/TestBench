"""Abstract base class for backend question type handlers."""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple


class BaseQuestionType(ABC):
    """Protocol / base class for question type conversion and validation."""

    type_name: str  # DB type: single_choice, numeric, multi_choice, true_false
    cbt_type: str   # CBT JSON type: single, numerical, multi, tf

    @abstractmethod
    def validate_answer(self, answer_dict: Dict[str, Any]) -> bool:
        """Validate answer shape for this question type."""
        ...

    @abstractmethod
    def to_cbt(
        self,
        paper_id: str,
        question_id: str,
        content: Dict[str, Any],
        options: List[Dict[str, Any]],
        answer: Dict[str, Any],
    ) -> Tuple[List[Dict[str, Any]], Any]:
        """Convert DB options and answer into CBT options list and CBT answer representation."""
        ...
