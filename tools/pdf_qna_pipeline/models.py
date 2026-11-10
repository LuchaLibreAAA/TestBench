"""Pydantic models for the Universal Q&A Database schema."""

from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field


class MarkingScheme(BaseModel):
    correct: int = 4
    wrong: int = -1
    unattempted: int = 0


class SectionMeta(BaseModel):
    sectionId: str
    sectionName: str
    subject: str
    questionType: str  # "single_choice" | "numeric"
    markingScheme: MarkingScheme = Field(default_factory=MarkingScheme)


class ExamMetadata(BaseModel):
    examName: str = "JEE Main"
    year: int = 2026
    session: Optional[str] = "April"
    date: Optional[str] = "2026-04-02"
    shift: Optional[str] = "Shift 2"
    paper: Optional[str] = "B.Tech"
    totalMarks: int = 300
    durationMinutes: int = 180
    totalQuestions: int = 75
    sourcePdf: str = ""


class ContentBlock(BaseModel):
    text: str = ""
    imagePaths: List[str] = Field(default_factory=list)


class OptionItem(BaseModel):
    id: str  # e.g. "opt-691121511"
    optionNumber: int
    optionId: str
    label: str  # "a", "b", "c", "d"
    text: str = ""
    imagePaths: List[str] = Field(default_factory=list)


class AnswerBlock(BaseModel):
    correctOptionId: Optional[str] = None
    correctNumericValue: Optional[float] = None
    isAnswerKeyAvailable: bool = False


class ExplanationBlock(BaseModel):
    text: str = ""
    imagePaths: List[str] = Field(default_factory=list)


class SourceMeta(BaseModel):
    pages: List[int] = Field(default_factory=list)
    extractor: Literal["embedded", "clip", "merged"] = "embedded"


class QuestionItem(BaseModel):
    id: str  # e.g. "q-691121151"
    questionNumber: int
    questionId: str
    sectionId: str
    subject: str
    type: Literal["single_choice", "numeric"]
    content: ContentBlock
    options: List[OptionItem] = Field(default_factory=list)
    answer: AnswerBlock = Field(default_factory=AnswerBlock)
    explanation: ExplanationBlock = Field(default_factory=ExplanationBlock)
    source: SourceMeta = Field(default_factory=SourceMeta)


class QnADatabase(BaseModel):
    schemaVersion: str = "1.0"
    examMetadata: ExamMetadata
    sections: List[SectionMeta]
    questions: List[QuestionItem]
