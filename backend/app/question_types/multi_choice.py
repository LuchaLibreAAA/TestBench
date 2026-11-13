"""Multiple-choice question type handler."""

from pathlib import Path
from typing import Any, Dict, List, Tuple
from backend.app.question_types.base import BaseQuestionType


class MultiChoiceType(BaseQuestionType):
    type_name = "multi_choice"
    cbt_type = "multi"

    def validate_answer(self, answer_dict: Dict[str, Any]) -> bool:
        ids = answer_dict.get("correctOptionIds")
        return isinstance(ids, list) and len(ids) > 0

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
        opt_ids = set(answer.get("correctOptionIds") or [])
        chosen = [o.get("label", "") for o in options if o.get("optionId") in opt_ids]
        cbt_answer = chosen if chosen else ["a"]
        return cbt_options, cbt_answer
