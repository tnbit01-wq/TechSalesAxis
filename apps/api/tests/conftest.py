import pytest

@pytest.fixture(scope='session')
def sample_fixture():
    return "sample data"

def pytest_configure():
    pytest.addoption("--myoption", action="store", default="default_value", help="Description of my option")