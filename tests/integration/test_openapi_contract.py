"""API surface contract — the refactor safety net (epic #2, Phase 0).

`openapi_baseline.json` pins every route path and its HTTP methods as they
exist today. The routes refactor must not silently drop, rename, or change the
verb of an endpoint; this test fails if it does.

Adding new endpoints is allowed and does not fail the test — only removals /
renames / method changes do. When an endpoint is intentionally removed or
renamed, regenerate the baseline in the same PR (see scripts at the bottom) so
the change is explicit and reviewable.
"""

import json
import os

import pytest

pytestmark = pytest.mark.integration

_BASELINE_PATH = os.path.join(os.path.dirname(__file__), "openapi_baseline.json")


def _current_surface(client):
    spec = client.get("/openapi.json").json()
    return {path: sorted(m.upper() for m in ops.keys()) for path, ops in spec["paths"].items()}


def test_no_endpoint_removed_or_changed(client):
    baseline = json.load(open(_BASELINE_PATH))
    current = _current_surface(client)

    missing_paths = sorted(set(baseline) - set(current))
    assert not missing_paths, (
        "Route paths disappeared from the API surface "
        f"(refactor regression?): {missing_paths}\n"
        "If intentional, regenerate tests/integration/openapi_baseline.json."
    )

    changed = {
        path: {"baseline": baseline[path], "current": current[path]}
        for path in baseline
        if path in current and baseline[path] != current[path]
    }
    # A method set may only grow (added verbs are fine); a verb vanishing is a regression.
    regressed = {p: d for p, d in changed.items() if set(d["baseline"]) - set(d["current"])}
    assert not regressed, (
        "HTTP methods removed/changed on existing paths "
        f"(refactor regression?): {json.dumps(regressed, indent=2)}\n"
        "If intentional, regenerate tests/integration/openapi_baseline.json."
    )
