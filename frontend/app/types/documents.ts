// Types for the /api/document(s) contract (routes/document_routes.py).

export interface DocumentSummary {
  id: string
  session_id: string | null
  session_name?: string | null
  title: string
  language: string | null
  preview?: string
  version_count: number
  created_at: string | null
  updated_at: string | null
}

export interface DocumentFull {
  id: string
  session_id: string | null
  title: string
  language: string | null
  current_content: string
  version_count: number
  is_active: boolean
  archived: boolean
  created_at: string | null
  updated_at: string | null
}

export interface LibraryDocsResponse {
  documents: DocumentSummary[]
  total: number
  languages: Record<string, number>
  session_count: number
}

export const DOC_LANGUAGES = [
  'text', 'markdown', 'python', 'javascript', 'typescript', 'html', 'css',
  'json', 'yaml', 'sql', 'bash', 'rust', 'go', 'java', 'c', 'cpp',
]
