"""Shell / script execution actions.

Part of the src.builtin_actions package.
"""

from __future__ import annotations

import os
from typing import Tuple
from core.platform_compat import IS_WINDOWS, find_bash
from ._base import _run_subprocess


async def action_ssh_command(
    owner: str, command: str = "", host: str = "localhost", **kwargs
) -> Tuple[str, bool]:
    """Run a shell command locally or on a remote host via SSH."""
    if not command:
        return "No command specified", False
    if host in ("localhost", "127.0.0.1", "local"):
        if IS_WINDOWS:
            bash = find_bash()
            if bash:
                return await _run_subprocess([bash, "-c", command], timeout=120, label="Command")
            return await _run_subprocess(command, shell=True, timeout=120, label="Command")
        return await _run_subprocess(["bash", "-c", command], timeout=120, label="Command")
    return await _run_subprocess(
        ["ssh", "-o", "ConnectTimeout=10", host, command],
        timeout=120,
        label="Command",
    )


async def action_run_script(
    owner: str, script: str = "", host: str = "", **kwargs
) -> Tuple[str, bool]:
    """Run a script locally, or via SSH when a host is configured."""
    if not script:
        return "No script specified", False
    target_host = (host or os.getenv("ODYSSEUS_SCRIPT_HOST", "localhost")).strip()
    if target_host in ("", "localhost", "127.0.0.1", "local"):
        if IS_WINDOWS and find_bash():
            return await _run_subprocess([find_bash(), "-c", script], timeout=300, label="Script")
        return await _run_subprocess(script, shell=True, timeout=300, label="Script")
    return await _run_subprocess(["ssh", target_host, script], timeout=300, label="Script")


async def action_run_local(owner: str, script: str = "", **kwargs) -> Tuple[str, bool]:
    """Run a script locally (no SSH)."""
    if not script:
        return "No script specified", False
    if IS_WINDOWS and find_bash():
        return await _run_subprocess([find_bash(), "-c", script], timeout=300, label="Script")
    return await _run_subprocess(script, shell=True, timeout=300, label="Script")
