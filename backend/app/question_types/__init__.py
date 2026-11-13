"""Backend question type registry."""

from typing import Dict, Optional
from backend.app.question_types.base import BaseQuestionType
from backend.app.question_types.single_choice import SingleChoiceType
from backend.app.question_types.multi_choice import MultiChoiceType
from backend.app.question_types.numeric import NumericType
from backend.app.question_types.true_false import TrueFalseType

_REGISTRY: Dict[str, BaseQuestionType] = {
    "single_choice": SingleChoiceType(),
    "single": SingleChoiceType(),
    "multi_choice": MultiChoiceType(),
    "multi": MultiChoiceType(),
    "numeric": NumericType(),
    "numerical": NumericType(),
    "true_false": TrueFalseType(),
    "tf": TrueFalseType(),
}


def get_question_type_handler(type_name: str) -> Optional[BaseQuestionType]:
    """Return handler for given DB or CBT question type."""
    return _REGISTRY.get(type_name)


def register_question_type(handler: BaseQuestionType) -> None:
    """Register an extension question type handler."""
    _REGISTRY[handler.type_name] = handler
    _REGISTRY[handler.cbt_type] = handler


__all__ = [
    "BaseQuestionType",
    "SingleChoiceType",
    "MultiChoiceType",
    "NumericType",
    "TrueFalseType",
    "get_question_type_handler",
    "register_question_type",
]
