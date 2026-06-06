"""Tool implementations (do_* coroutines + helpers), grouped by domain.

Public surface unchanged: every do_* tool, the active-document/model accessors,
and the document-sniffing helpers remain importable from src.tool_implementations.
"""

from .documents import (
    _looks_like_email_document,
    _sniff_doc_language,
    do_create_document,
    do_edit_document,
    do_manage_documents,
    do_suggest_document,
    do_update_document,
    get_active_document,
    set_active_document,
    set_active_model,
)
from .manage_tools import (
    do_api_call,
    do_app_api,
    do_edit_image,
    do_manage_endpoints,
    do_manage_mcp,
    do_manage_settings,
    do_manage_skills,
    do_manage_tasks,
    do_manage_tokens,
    do_manage_webhooks,
    do_search_chats,
)
from .personal import (
    do_manage_calendar,
    do_manage_contact,
    do_manage_notes,
    do_manage_research,
    do_resolve_contact,
    do_trigger_research,
)
from .models import (
    do_adopt_served_model,
    do_cancel_download,
    do_download_model,
    do_list_cached_models,
    do_list_cookbook_servers,
    do_list_downloads,
    do_list_serve_presets,
    do_list_served_models,
    do_search_hf_models,
    do_serve_model,
    do_serve_preset,
    do_stop_served_model,
)
from .vault import (
    do_vault_get,
    do_vault_search,
    do_vault_unlock,
)
