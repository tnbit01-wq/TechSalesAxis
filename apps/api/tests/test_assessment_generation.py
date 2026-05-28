import pytest

from src.services.assessment_service import AssessmentService


@pytest.fixture(scope="module")
def service():
    return AssessmentService()


def test_category_targets_sum_to_budget_and_keep_resume_share(service):
    target_dist = {
        "resume": 0.20,
        "skill": 0.30,
        "behavioral": 0.25,
        "psychometric": 0.25,
    }

    targets = service._allocate_category_targets(13, target_dist)

    assert sum(targets.values()) == 13
    assert targets["resume"] == 3
    assert targets["skill"] == 4
    assert targets["behavioral"] == 3
    assert targets["psychometric"] == 3


def test_preferred_category_prefers_resume_when_deficit_is_tied(service):
    target_counts = {
        "resume": 3,
        "skill": 4,
        "behavioral": 3,
        "psychometric": 3,
    }
    category_deficit = {
        "resume": 1,
        "skill": 1,
        "behavioral": 0,
        "psychometric": 0,
    }

    preferred = service._pick_preferred_category(category_deficit, target_counts)

    assert preferred == "resume"


def test_resume_branch_is_forced_when_quota_remains(service):
    category_deficit = {
        "resume": 1,
        "skill": 2,
        "behavioral": 2,
        "psychometric": 2,
    }
    target_counts = {
        "resume": 3,
        "skill": 4,
        "behavioral": 3,
        "psychometric": 3,
    }
    answered_count = {
        "resume": 2,
        "skill": 0,
        "behavioral": 0,
        "psychometric": 0,
    }

    assert service._should_force_resume_question(category_deficit, target_counts, answered_count) is True


def test_resume_branch_does_not_force_when_quota_is_met(service):
    category_deficit = {
        "resume": 0,
        "skill": 2,
        "behavioral": 2,
        "psychometric": 2,
    }
    target_counts = {
        "resume": 3,
        "skill": 4,
        "behavioral": 3,
        "psychometric": 3,
    }
    answered_count = {
        "resume": 3,
        "skill": 0,
        "behavioral": 0,
        "psychometric": 0,
    }

    assert service._should_force_resume_question(category_deficit, target_counts, answered_count) is False


@pytest.mark.parametrize(
    "skill_name,skill_type,experience_band",
    [
        ("Cross-Functional Collaboration", "business", "senior"),
        ("Negotiation", "general", "mid"),
    ],
)
def test_skill_fallback_is_dynamic_not_static(service, skill_name, skill_type, experience_band):
    payload = service._compose_dynamic_skill_question_text(skill_name, skill_type, experience_band)
    text = payload["question_text"]

    assert "In a scale, risk, and decision quality scenario" not in text
    assert "What would you do, why would you choose that approach, and what outcome would prove it worked?" not in text
    assert skill_name.lower().split()[0] in text.lower()
    assert len(text.split()) >= 12
