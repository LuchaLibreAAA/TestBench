"""Numeric question type handler."""

from typing import Any, Dict, List, Tuple
from backend.app.question_types.base import BaseQuestionType


class NumericType(BaseQuestionType):
    type_name = "numeric"
    cbt_type = "numerical"

    def validate_answer(self, answer_dict: Dict[str, Any]) -> bool:
        val = answer_dict.get("correctNumericValue")
        return isinstance(val, (int, float))

    def to_cbt(
        self,
        paper_id: str,
        question_id: str,
        content: Dict[str, Any],
        options: List[Dict[str, Any]],
        answer: Dict[str, Any],
    ) -> Tuple[List[Dict[str, Any]], Any]:
        return [], answer.get("correctNumericValue", 0)
