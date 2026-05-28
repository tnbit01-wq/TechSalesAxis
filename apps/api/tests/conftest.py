import pytest

@pytest.fixture(scope='session')
def sample_fixture():
    return "sample data"

def pytest_addoption(parser):
    parser.addoption("--myoption", action="store", default="default_value", help="Description of my option")