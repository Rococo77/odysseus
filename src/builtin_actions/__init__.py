"""Built-in automation actions, grouped by domain.

Public surface is unchanged: the ``action_*`` coroutines, the ``TaskNoop`` /
``TaskDeferred`` control-flow exceptions, and the ``BUILTIN_ACTIONS`` /
``BUILTIN_ACTION_INFO`` registries.
"""

from ._base import TaskNoop, TaskDeferred
from .tidy import (
    action_tidy_sessions,
    action_tidy_documents,
    action_consolidate_memory,
    action_tidy_research,
    action_tidy_calendar,
)
from .scripts import action_ssh_command, action_run_script, action_run_local
from .email_actions import (
    action_summarize_emails,
    action_draft_email_replies,
    action_extract_email_events,
    action_mark_email_boundaries,
    action_learn_sender_signatures,
    action_check_email_urgency,
)
from .events import action_classify_events, action_ping_events
from .skills import action_test_skills, action_audit_skills
from .notes import action_ping_notes
from .brief import action_daily_brief

BUILTIN_ACTIONS = {
    "tidy_sessions": action_tidy_sessions,
    "tidy_documents": action_tidy_documents,
    "consolidate_memory": action_consolidate_memory,
    "tidy_research": action_tidy_research,
    "summarize_emails": action_summarize_emails,
    "draft_email_replies": action_draft_email_replies,
    "extract_email_events": action_extract_email_events,
    "classify_events": action_classify_events,
    # ping_events removed from the user-facing registry. Calendar reminders
    # are represented as Notes, so note pings are the single dispatch path.
    "daily_brief": action_daily_brief,
    "mark_email_boundaries": action_mark_email_boundaries,
    "learn_sender_signatures": action_learn_sender_signatures,
    "ssh_command": action_ssh_command,
    "run_script": action_run_script,
    "run_local": action_run_local,
    "test_skills": action_test_skills,
    "audit_skills": action_audit_skills,
    "check_email_urgency": action_check_email_urgency,
    # ping_notes removed from the registry — runs only inside `_note_pings_loop`.
}

BUILTIN_ACTION_INFO = {
    "tidy_sessions": "Clean up empty chat sessions and auto-sort into folders",
    "tidy_documents": "Remove junk/empty documents",
    "consolidate_memory": "Remove duplicate memories",
    "tidy_research": "Remove orphaned research files (sessions that were deleted)",
    "summarize_emails": "Pre-generate AI summaries for new inbox emails",
    "draft_email_replies": "Pre-draft AI reply suggestions for new inbox emails",
    "extract_email_events": "Scan emails for booking/meeting confirmations and auto-add to calendar",
    "classify_events": "Tag upcoming events with importance (low/normal/high/critical) and type (work/health/travel/etc.); colors them too",
    "daily_brief": "Build a morning digest: today's calendar, unread email count + top senders, active todos",
    "mark_email_boundaries": "LLM-detect signature & quoted-reply offsets in new emails; cached so future renders fold without further LLM calls",
    "learn_sender_signatures": "LLM learns each sender's signature from 3+ of their recent emails; cached per address so future renders fold sigs reliably without heuristics",
    "ssh_command": "Run a shell command on a local or remote host",
    "run_script": "Run a script locally or on ODYSSEUS_SCRIPT_HOST",
    "test_skills": "Run the per-skill Test on every skill: agent run + LLM judge → records verdict on the skill (pass/needs_work/fail/inconclusive). Advisory only — never rewrites or demotes anything.",
    "audit_skills": "Audit unaudited skills after enough new skills are added: test, narrow metadata, self-edit/retry, optional teacher rewrite, tag duplicates/trivial skills, and publish/draft using the auto-approve threshold.",
    "check_email_urgency": "Scan unread emails hourly, tag urgent/reply-soon/newsletter/marketing/spam, and send a reminder when a new email needs a fast reply.",
}
