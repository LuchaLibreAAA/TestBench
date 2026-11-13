"""True/False question type handler."""

from typing import Any, Dict, List, Tuple
from backend.app.question_types.base import BaseQuestionType


class TrueFalseType(BaseQuestionType):
    type_name = "true_false"
    cbt_type = "tf"

    def validate_answer(self, answer_dict: Dict[str, Any]) -> bool:
        return "correctBooleanValue" in answer_dict and isinstance(answer_dict["correctBooleanValue"], bool)

    def to_cbt(
        self,
        paper_id: str,
        question_id: str,
        content: Dict[str, Any],
        options: List[Dict[str, Any]],
        answer: Dict[str, Any],
    ) -> Tuple[List[Dict[str, Any]], Any]:
        val = bool(answer.get("correctBooleanValue", True))
        cbt_options = [
            {"id": "true", "text": {"en": "True"}, "image": ""},
            {"id": "false", "text": {"en": "False"}, "image": ""},
        ]
        return cbt_options, "true" if val else "false"
