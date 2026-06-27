from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ImageAnalysis:
    image_id: str
    image_path: str
    visible_issue: str
    object_part: str
    severity: str
    visible_damage: bool
    image_quality: str
    wrong_object: bool
    explanation: str
    blur_score: Optional[float] = None
    is_blurry: bool = False


@dataclass
class Claim:
    id: str
    user_id: str
    image_paths: list[str]
    user_claim: str
    claim_object: str
    evidence_standard_met: Optional[bool] = None
    evidence_standard_met_reason: Optional[str] = None
    risk_flags: list[str] = field(default_factory=list)
    issue_type: Optional[str] = None
    object_part: Optional[str] = None
    claim_status: Optional[str] = None
    claim_status_justification: Optional[str] = None
    supporting_image_ids: list[str] = field(default_factory=list)
    valid_image: Optional[bool] = None
    severity: Optional[str] = None
    processed: bool = False
    image_analyses: Optional[list[ImageAnalysis]] = None
    processing_time_seconds: Optional[float] = None
    token_usage: Optional[int] = None


# Allowed enum values for output validation
ALLOWED_CLAIM_STATUSES = {"supported", "contradicted", "not_enough_information"}

ALLOWED_ISSUE_TYPES = {
    "dent", "scratch", "crack", "glass_shatter", "broken_part",
    "missing_part", "torn_packaging", "crushed_packaging",
    "water_damage", "stain", "none", "unknown"
}

ALLOWED_RISK_FLAGS = {
    "none", "blurry_image", "cropped_or_obstructed", "low_light_or_glare",
    "wrong_angle", "wrong_object", "wrong_object_part", "damage_not_visible",
    "claim_mismatch", "possible_manipulation", "non_original_image",
    "text_instruction_present", "user_history_risk", "manual_review_required"
}

ALLOWED_SEVERITIES = {"none", "low", "medium", "high", "unknown"}
