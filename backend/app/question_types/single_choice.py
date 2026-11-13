"""Single-choice question type handler."""

from pathlib import Path
from typing import Any, Dict, List, Tuple
from backend.app.question_types.base import BaseQuestionType


class SingleChoiceType(BaseQuestionType):
    type_name = "single_choice"
    cbt_type = "single"

    def validate_answer(self, answer_dict: Dict[str, Any]) -> bool:
        return bool(answer_dict.get("correctOptionId"))

    def to_cbt(
        self,
        paper_id: str,
        question_id: str,
        content: Dict[str, Any],
        options: List[Dict[str, Any]],
        answer: Dict[str, Any],
    ) -> Tuple[List[Dict[str, Any]], Any]:
        cbt_options = [
            {
                "id": opt.get("label", ""),
                "text": {"en": opt.get("text", "")},
                "image": f"/api/v1/assets/{paper_id}/{Path(opt['imagePaths'][0]).name}"
                if opt.get("imagePaths")
                else "",
            }
            for opt in options
        ]
        chosen = next(
            (o.get("label", "") for o in options if o.get("optionId") == answer.get("correctOptionId")),
            None,
        )
        cbt_answer = [chosen or (options[0].get("label", "a") if options else "a")]
        return cbt_options, cbt_answer
