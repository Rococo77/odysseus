"""App-assembly building blocks extracted from ``app.py``.

Each module here owns a single slice of application wiring (a middleware, the
static-file mounts, the auth layer) so ``app.py`` can stay a thin orchestrator
that just composes them.
"""
