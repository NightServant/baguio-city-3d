# Run: uv run --python 3.13 --with pytest --with numpy==2.3.3 --with shapely==2.1.2 --with pyproj==3.8.0 --with mapbox-earcut==1.0.3 pytest model/scripts/test_build_roads.py -q
import sys
from pathlib import Path

from shapely.geometry import LineString

sys.path.insert(0, str(Path(__file__).parent))
from build_roads import SIDEWALK_M, runs_along  # noqa: E402

ROAD = LineString([(0, 0), (100, 0)])


def test_a_stair_beside_the_street_runs_along():
    assert runs_along(LineString([(20, 5), (50, 6)]), ROAD, 3.1)


def test_a_stair_leaving_the_street_does_not():
    assert not runs_along(LineString([(30, 4), (32, 40)]), ROAD, 3.1)


def test_a_parallel_stair_beyond_the_sidewalk_does_not():
    assert not runs_along(LineString([(20, 3.1 + SIDEWALK_M + 5), (50, 3.1 + SIDEWALK_M + 5)]), ROAD, 3.1)
