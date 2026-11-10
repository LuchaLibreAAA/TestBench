"""Unit tests for candidate regexes using actual strings from the PDF."""

import re
import pytest
from tools.pdf_qna_pipeline.config import load_config


@pytest.fixture
def cfg():
    return load_config("jee_main")


def test_section_regex(cfg):
    pattern = re.compile(cfg["regex"]["section"], re.MULTILINE)

    sample_1 = "\n\nMathematics Section A\nSection Id :\n69112113"
    m1 = pattern.search(sample_1)
    assert m1 is not None
    assert m1.group(1) == "Mathematics"
    assert m1.group(2) == "A"

    sample_2 = "\nPhysics Section B\nSection Id :\n69112116"
    m2 = pattern.search(sample_2)
    assert m2 is not None
    assert m2.group(1) == "Physics"
    assert m2.group(2) == "B"

    sample_3 = "\nChemistry Section A\nSection Id :\n69112117"
    m3 = pattern.search(sample_3)
    assert m3 is not None
    assert m3.group(1) == "Chemistry"
    assert m3.group(2) == "A"


def test_question_header_regex(cfg):
    pattern = re.compile(cfg["regex"]["question_header"])

    sample_mcq = "Question Number : 2 Question Id : 691121152 Question Type : MCQ Option Shuffling : Yes"
    m_mcq = pattern.search(sample_mcq)
    assert m_mcq is not None
    assert m_mcq.group(1) == "2"
    assert m_mcq.group(2) == "691121152"
    assert m_mcq.group(3) == "MCQ"

    sample_sa = "Question Number : 21 Question Id : 691121171 Question Type : SA Display Question Number : Yes"
    m_sa = pattern.search(sample_sa)
    assert m_sa is not None
    assert m_sa.group(1) == "21"
    assert m_sa.group(2) == "691121171"
    assert m_sa.group(3) == "SA"


def test_option_id_regex(cfg):
    pattern = re.compile(cfg["regex"]["option_id"], re.MULTILINE)

    sample_opts = "Options :\n691121515. \n691121516. \n691121517. \n691121518. \n\xa0\n"
    matches = pattern.findall(sample_opts)
    assert matches == ["691121515", "691121516", "691121517", "691121518"]
