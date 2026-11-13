"""API Request and Response schemas."""

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class PaperSummary(BaseModel):
    """Summary of a paper for library/catalog listings."""
    id: str
    title: str
    exam: str
    examCode: Optional[str] = None
    year: int
    durationMin: int
    totalQuestions: int
    sectionsCount: int
    badge: Optional[str] = None
    status: Optional[str] = "published"
    minClientVersion: Optional[int] = 1
    requiredFeatures: Optional[List[str]] = Field(default_factory=list)


class PaginatedQuestionsResponse(BaseModel):
    """Paginated list of Q&A questions."""
    page: int
    limit: int
    total: int
    pages: int
    items: List[Dict[str, Any]]


class UploadResponse(BaseModel):
    """Response after PDF upload and pipeline processing."""
    success: bool
    paperId: str
    totalQuestions: int
    message: str


class CatalogResponse(BaseModel):
    items: List[PaperSummary]


class JobResponse(BaseModel):
    status: str
    paperId: Optional[str] = None
    error: Optional[str] = None


class JobCreatedResponse(BaseModel):
    jobId: str


class AnswerUpdate(BaseModel):
    questionId: str
    correctOptionId: Optional[str] = None
    correctNumericValue: Optional[float] = None
    correctOptionIds: Optional[List[str]] = None
    correctBooleanValue: Optional[bool] = None


class AnswerPatchRequest(BaseModel):
    answers: List[AnswerUpdate]


class AnswerPatchResponse(BaseModel):
    updated: int


class AdminExamRequest(BaseModel):
    code: str
    name: str
    badge: Optional[str] = None
    defaultMarkingStrategy: str = "nta-standard"
    pipelineConfig: Optional[str] = None
    configJson: Optional[str] = "{}"
    position: int = 0
    active: int = 1


class AdminPaperPatchRequest(BaseModel):
    title: Optional[str] = None
    status: Optional[Literal["draft", "published", "archived"]] = None
    examCode: Optional[str] = None
    minClientVersion: Optional[int] = None
    requiredFeatures: Optional[List[str]] = None


class AdminAssetReplaceResponse(BaseModel):
    paperId: str
    filename: str
    sha256: str
    dataVersion: int


class ExamSummary(BaseModel):
    code: str
    name: str
    badge: Optional[str] = None
    defaultMarkingStrategy: str
    position: int
    active: int
    papersCount: int = 0


class MetaResponse(BaseModel):
    apiVersion: str = "v1"
    supportedSchemaVersions: List[str] = Field(default_factory=lambda: ["1.0", "1"])
    minSupportedClient: Dict[str, str] = Field(default_factory=lambda: {"web": "0.0.2", "android": "1.0.0"})
    features: List[str] = Field(default_factory=lambda: [
        "single_choice", "multi_choice", "numeric", "true_false",
        "content_blocks", "offline_packages", "webp_variants"
    ])
    serverTime: str


class ManifestAsset(BaseModel):
    filename: str
    sha256: str
    bytes: int
    role: str
    url: str


class PaperManifestResponse(BaseModel):
    paperId: str
    dataVersion: int
    contentHash: str
    assets: List[ManifestAsset]
