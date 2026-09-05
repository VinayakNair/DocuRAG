import { useState, useEffect, useRef } from 'react'
import BackgroundAnimation from './components/BackgroundAnimation'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const FAKE_FILES = [
  'README.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'docs/index.md',
  'docs/advanced.md',
  'docs/tutorial.md',
  'docs/concepts.md',
  'src/api.py',
  'src/models.py'
]

const PIPELINE_STEPS = [
  { title: "Extraction", desc: "Cloning repo & isolating markdown files", side: "left" },
  { title: "Processing", desc: "Cleaning HTML, protecting code & chunking text", side: "right" },
  { title: "Ingestion", desc: "Generating neural embeddings & upserting to ChromaDB", side: "left" }
]

const PRESET_REPOS = [
  { name: "tiangolo/fastapi", label: "FastAPI", desc: "Modern Python web framework" },
  { name: "pallets/flask", label: "Flask", desc: "Lightweight WSGI framework" },
  { name: "encode/starlette", label: "Starlette", desc: "High-performance ASGI toolkit" },
  { name: "psf/requests", label: "Requests", desc: "HTTP for Humans" }
]

const DEFAULT_SUGGESTIONS = [
  "How does dependency injection work in FastAPI?",
  "How to configure CORS middleware safely?",
  "How to handle background tasks and worker threads?",
  "How to define path parameters with Pydantic validation?"
]

function App() {
  // Theme state: 'dark' | 'light'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('docurag-theme') || 'dark'
  })

  // Navigation: 'dashboard' | 'search' | 'repository' | 'docs'
  const [activeTab, setActiveTab] = useState('dashboard')

  // Search & Dynamic Suggestions State
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [nResults, setNResults] = useState(5)
  const [selectedRepoFilter, setSelectedRepoFilter] = useState('')
  const [suggestedQueries, setSuggestedQueries] = useState(DEFAULT_SUGGESTIONS)
  const [suggestionsSourceRepo, setSuggestionsSourceRepo] = useState('FastAPI')
  const searchInputRef = useRef(null)

  // Ingestion State
  const [ingestUrl, setIngestUrl] = useState('')
  const [ingesting, setIngesting] = useState(false)
  const [ingestionComplete, setIngestionComplete] = useState(false)
  const [ingestMetrics, setIngestMetrics] = useState(null)
  const [ingestError, setIngestError] = useState(null)

  // Ingestion Pipeline UI State
  const [activeStep, setActiveStep] = useState(0)
  const [progressCount, setProgressCount] = useState(0)
  const maxProgress = 15
  const [currentFile, setCurrentFile] = useState('README.md')

  // Backend Stats & Health
  const [stats, setStats] = useState({ total_chunks: 0, repositories: [], embedding_model: 'all-MiniLM-L6-v2', status: 'checking' })
  const [apiOnline, setApiOnline] = useState(null)

  // Toast notification
  const [toast, setToast] = useState(null)
  const [copiedIdx, setCopiedIdx] = useState(null)

  // Apply theme to html root and persist
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('docurag-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  // Fetch backend stats on mount & periodically
  const fetchStats = async () => {
    try {
      const resp = await fetch(`${API_BASE}/stats`)
      if (resp.ok) {
        const data = await resp.json()
        setStats(data)
        setApiOnline(true)
      } else {
        setApiOnline(false)
      }
    } catch {
      setApiOnline(false)
    }
  }

  // Dynamically load repository-specific search suggestions
  const loadSuggestionsForRepo = async (repoName) => {
    if (!repoName) {
      setSuggestedQueries(DEFAULT_SUGGESTIONS)
      setSuggestionsSourceRepo('FastAPI')
      return
    }

    try {
      const resp = await fetch(`${API_BASE}/suggestions?repo=${encodeURIComponent(repoName)}`)
      if (resp.ok) {
        const data = await resp.json()
        if (data.suggestions && data.suggestions.length > 0) {
          setSuggestedQueries(data.suggestions)
          setSuggestionsSourceRepo(repoName)
        }
      }
    } catch (err) {
      console.error('Failed to load suggestions:', err)
    }
  }

  useEffect(() => {
    fetchStats()
    const timer = setInterval(fetchStats, 30000)
    return () => clearInterval(timer)
  }, [])

  // Automatically load suggestions for the most recently active repository on startup
  useEffect(() => {
    if (stats.repositories && stats.repositories.length > 0 && suggestionsSourceRepo === 'FastAPI') {
      const latestRepo = stats.repositories[stats.repositories.length - 1]
      loadSuggestionsForRepo(latestRepo)
    }
  }, [stats.repositories, suggestionsSourceRepo])

  // Update suggestions when user selects a repository filter
  useEffect(() => {
    if (selectedRepoFilter) {
      loadSuggestionsForRepo(selectedRepoFilter)
    }
  }, [selectedRepoFilter])

  // Cmd+K / Ctrl+K keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (activeTab !== 'search' && activeTab !== 'dashboard') {
          setActiveTab('search')
        }
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab])

  // Ingestion animation simulation
  useEffect(() => {
    let interval
    let fileInterval

    if (ingesting) {
      interval = setInterval(() => {
        setActiveStep((prev) => (prev < 3 ? prev + 1 : prev))
      }, 3500)

      fileInterval = setInterval(() => {
        setProgressCount((prev) => (prev < maxProgress ? prev + 1 : prev))
        setCurrentFile(FAKE_FILES[Math.floor(Math.random() * FAKE_FILES.length)])
      }, 600)
    } else {
      setActiveStep(0)
      setProgressCount(0)
      setCurrentFile('')
    }

    return () => {
      clearInterval(interval)
      clearInterval(fileInterval)
    }
  }, [ingesting])

  const handleIngest = async (e, customUrl = null) => {
    if (e && e.preventDefault) e.preventDefault()
    const targetUrl = customUrl || ingestUrl
    if (!targetUrl.trim()) return

    setIngesting(true)
    setIngestError(null)
    setIngestionComplete(false)
    setIngestMetrics(null)
    setResults([])
    setHasSearched(false)

    try {
      const response = await fetch(`${API_BASE}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_url: targetUrl })
      })

      const data = await response.json()

      if (data.chunks_processed && data.chunks_processed > 0) {
        setActiveStep(3)
        setProgressCount(15)
        setIngestionComplete(true)
        const cleanRepo = data.repository || targetUrl.trim().replace(/\/+$/, '').split('/').pop() || 'repo'
        setIngestMetrics({
          repo: cleanRepo,
          chunks: data.chunks_processed
        })
        setIngestUrl('')

        // Update suggestions immediately for the newly ingested repository
        if (data.suggested_queries && data.suggested_queries.length > 0) {
          setSuggestedQueries(data.suggested_queries)
          setSuggestionsSourceRepo(cleanRepo)
        } else {
          loadSuggestionsForRepo(cleanRepo)
        }

        showToast(`Successfully indexed ${cleanRepo}!`)
        fetchStats()
      } else {
        setIngestError(data.message || 'Ingestion failed.')
        setIngesting(false)
        setActiveStep(0)
      }
    } catch (error) {
      console.error('Failed to ingest:', error)
      setIngestError('Cannot connect to DocuRAG API. Ensure the backend server is running.')
      setIngesting(false)
      setActiveStep(0)
    }
  }

  const handleSearch = async (e, customQuery = null) => {
    if (e && e.preventDefault) e.preventDefault()
    const queryText = customQuery !== null ? customQuery : query
    if (!queryText.trim()) return

    if (customQuery !== null) {
      setQuery(customQuery)
    }

    setLoading(true)
    setHasSearched(true)
    setSearchError(null)

    try {
      let url = `${API_BASE}/search?q=${encodeURIComponent(queryText)}&n_results=${nResults}`
      if (selectedRepoFilter) {
        url += `&repo=${encodeURIComponent(selectedRepoFilter)}`
      }

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`)
      }
      const data = await response.json()
      setResults(data.results || [])
    } catch (error) {
      console.error('Failed to fetch results:', error)
      setSearchError('Unable to connect to the search service. Please check your backend connection.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleCopySnippet = (text, idx) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx)
      showToast('Snippet copied to clipboard!')
      setTimeout(() => setCopiedIdx(null), 2000)
    })
  }

  const getGitHubFileUrl = (repo, source) => {
    if (!repo || !source || source === 'Unknown') return null
    return `https://github.com/${repo}/blob/main/${source}`
  }

  const formatText = (text) => {
    let displayText = text
    if (displayText.length > 700) {
      displayText = displayText.substring(0, 700) + '...'
      const fenceCount = (displayText.match(/```/g) || []).length
      if (fenceCount % 2 !== 0) {
        displayText += '\n```'
      }
    }

    return displayText.split(/(```[\s\S]*?```|`[^`]+`)/g).map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const inner = part.slice(3, -3).replace(/^[a-zA-Z0-9_-]+\n/, '')
        return (
          <pre key={i} className="code-block">
            <code>{inner.trim()}</code>
          </pre>
        )
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="inline-code">
            {part.slice(1, -1)}
          </code>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  // Render search results block
  const renderSearchResults = () => {
    if (!hasSearched) return null

    return (
      <div className="search-results-block">
        <div className="results-header">
          <div>
            <h3 className="section-title mb-0">Search Results</h3>
            <span className="results-subcount">
              Found {results.length} relevant chunk{results.length === 1 ? '' : 's'} for &ldquo;{query}&rdquo;
            </span>
          </div>

          <div className="results-controls">
            {stats.repositories && stats.repositories.length > 0 && (
              <select
                className="repo-filter-select"
                value={selectedRepoFilter}
                onChange={(e) => setSelectedRepoFilter(e.target.value)}
              >
                <option value="">All Repositories</option>
                {stats.repositories.map((r, i) => (
                  <option key={i} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            )}

            <select
              className="repo-filter-select"
              value={nResults}
              onChange={(e) => setNResults(Number(e.target.value))}
            >
              <option value={3}>Top 3</option>
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
            </select>
          </div>
        </div>

        {loading && (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <span>Calculating vector similarities across knowledge base...</span>
          </div>
        )}

        {searchError && (
          <div className="error-banner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{searchError}</span>
          </div>
        )}

        {!loading && !searchError && results.length === 0 && (
          <div className="empty-results">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <p className="empty-title">No matching document chunks found</p>
            <p className="empty-desc">Try rephrasing your search query or ingest a new repository with related documentation.</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="results-list">
            {results.map((result, idx) => {
              const githubUrl = getGitHubFileUrl(result.repository, result.source)
              return (
                <div key={idx} className="result-item">
                  <div className="result-top-bar">
                    <div className="result-meta">
                      <span className="rank-badge">#{idx + 1}</span>
                      <span className="badge repository">{result.repository}</span>
                      <span className="badge source">{result.source}</span>
                    </div>

                    <div className="result-actions">
                      {githubUrl && (
                        <a
                          href={githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="action-btn github-link-btn"
                          title="View file on GitHub"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                          </svg>
                          GitHub
                        </a>
                      )}

                      <button
                        type="button"
                        className={`action-btn copy-btn ${copiedIdx === idx ? 'copied' : ''}`}
                        onClick={() => handleCopySnippet(result.text, idx)}
                        title="Copy text snippet"
                      >
                        {copiedIdx === idx ? (
                          <>
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10b981" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Copied
                          </>
                        ) : (
                          <>
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="result-body">{formatText(result.text)}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="layout">
      {/* Ambient Interactive Vector Background Animation */}
      <BackgroundAnimation theme={theme} />

      {/* Floating Toast Notification */}
      {toast && (
        <div className="toast-notification">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{toast}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="main-content">
        {/* Top Navbar */}
        <header className="top-nav">
          <div className="title-area">
            <span className="brand-primary">Docu</span>
            <span className="brand-secondary">RAG</span>
            <span className="version-pill">v1.1</span>
          </div>

          <div className="top-pills">
            {/* Functional Tab Selector */}
            <div className="pill-nav">
              <button
                className={activeTab === 'dashboard' ? 'active' : ''}
                onClick={() => setActiveTab('dashboard')}
              >
                Dashboard
              </button>
              <button
                className={activeTab === 'search' ? 'active' : ''}
                onClick={() => setActiveTab('search')}
              >
                Search
              </button>
              <button
                className={activeTab === 'repository' ? 'active' : ''}
                onClick={() => setActiveTab('repository')}
              >
                Repositories
              </button>
              <button
                className={activeTab === 'docs' ? 'active' : ''}
                onClick={() => setActiveTab('docs')}
              >
                Docs
              </button>
            </div>

            {/* Dark/Light Mode Switcher */}
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>

            {/* Live Backend Health Indicator */}
            <div
              className={`health-badge ${apiOnline === true ? 'online' : apiOnline === false ? 'offline' : 'connecting'}`}
              title={apiOnline ? 'Backend API is connected and responding' : 'Backend API connection failed'}
              onClick={fetchStats}
            >
              <span className="status-dot"></span>
              <span className="status-text">
                {apiOnline === true
                  ? `API Ready (${stats.total_chunks || 0} chunks)`
                  : apiOnline === false
                  ? 'API Offline (Retry)'
                  : 'Connecting...'}
              </span>
            </div>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="dashboard-grid">
          {/* TAB 1: DASHBOARD VIEW */}
          {activeTab === 'dashboard' && (
            <>
              {/* Stats Overview Ribbon */}
              <div className="stats-ribbon">
                <div className="stat-card">
                  <div className="stat-icon purple">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                      <line x1="8" y1="21" x2="16" y2="21"></line>
                      <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{stats.total_chunks || 0}</span>
                    <span className="stat-label">Indexed Chunks</span>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon green">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{stats.repositories?.length || 0}</span>
                    <span className="stat-label">Active Repositories</span>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon blue">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polygon points="10 8 16 12 10 16 10 8"></polygon>
                    </svg>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">all-MiniLM-L6-v2</span>
                    <span className="stat-label">Dense Embedder</span>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon orange">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    </svg>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">ChromaDB</span>
                    <span className="stat-label">Vector Storage</span>
                  </div>
                </div>
              </div>

              {/* 1. REPOSITORY INGESTION & PIPELINE SECTION (On Top) */}
              <div className="panel-card ingestion-card">
                <section className="dashboard-section mb-0">
                  <div className="section-header-flex">
                    <h2 className="section-title">Repository Ingestion</h2>
                    <span className="section-subtitle">Turn any GitHub repository into a searchable vector index</span>
                  </div>

                  <div className="ingest-card-inner">
                    <div className="drag-drop-zone">
                      <p className="zone-title">Automatic Markdown Pipeline</p>
                      <p className="zone-desc">Recursively isolates .md/.mdx files, extracts code blocks, and creates vector embeddings</p>
                    </div>

                    <div className="ingest-form-wrapper">
                      <label className="input-label">GitHub Repository URL or Shorthand</label>
                      <input
                        type="text"
                        className="repo-input"
                        placeholder="e.g. tiangolo/fastapi or https://github.com/pallets/flask"
                        value={ingestUrl}
                        onChange={(e) => setIngestUrl(e.target.value)}
                        disabled={ingesting}
                      />

                      {/* Quick Preset Buttons */}
                      <div className="preset-buttons-row">
                        <span className="preset-label">Presets:</span>
                        {PRESET_REPOS.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="preset-chip"
                            disabled={ingesting}
                            onClick={() => {
                              setIngestUrl(preset.name)
                              handleIngest(null, preset.name)
                            }}
                            title={preset.desc}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={handleIngest}
                        className="btn-primary full-width"
                        disabled={ingesting || !ingestUrl.trim()}
                      >
                        {ingesting ? 'Processing Ingestion Pipeline...' : 'Ingest Repository'}
                      </button>
                      {ingestError && <div className="error-text mt-2">{ingestError}</div>}
                    </div>
                  </div>
                </section>

                {/* TIMELINE UI OVERLAY WHEN INGESTING */}
                {(ingesting || ingestionComplete) && !ingestError && (
                  <div className="pipeline-container mt-4">
                    <div className="pipeline-card">
                      <h3 className="pipeline-header">LIVE INGESTION PIPELINE</h3>

                      <div className="vertical-timeline">
                        {PIPELINE_STEPS.map((step, idx) => {
                          const isCompleted = activeStep > idx
                          const isActive = activeStep === idx

                          return (
                            <div
                              key={idx}
                              className={`timeline-node ${step.side} ${isCompleted || isActive ? 'active' : ''}`}
                            >
                              <div className={`node-icon ${isCompleted || isActive ? 'completed' : ''}`}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              </div>
                              <div className="node-content">
                                <h4>{step.title}</h4>
                                <p>{isCompleted ? 'Finished' : isActive ? 'Processing...' : 'Pending'}</p>
                                <span className="node-subdesc">{step.desc}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="terminal-monitor">
                        <div className="terminal-header">
                          CURRENT STAGE: {activeStep < 3 ? PIPELINE_STEPS[activeStep].title.toUpperCase() : 'COMPLETE'}
                        </div>
                        <div className="terminal-progress-bar">
                          <div
                            className="terminal-progress-fill"
                            style={{
                              width: `${(Math.min(progressCount, maxProgress) / maxProgress) * 100}%`
                            }}
                          ></div>
                        </div>
                        <div className="terminal-logs">
                          {!ingestionComplete ? (
                            <>
                              <div>&gt; Initializing worker connection...</div>
                              <div className="log-line">&gt; Parsing document: {currentFile} ({Math.floor((progressCount / maxProgress) * 100)}% complete)...</div>
                              <div className="log-line">&gt; Computing 384-dimensional dense vectors via all-MiniLM-L6-v2...</div>
                            </>
                          ) : (
                            <div className="success-log">
                              <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="#10b981" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                              <span>
                                Ingestion Complete! Stored {ingestMetrics?.chunks || 0} chunks from {ingestMetrics?.repo} in ChromaDB.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. SEMANTIC SEARCH SECTION (On Bottom - Search Bar + Results DIRECTLY Together) */}
              <div className="panel-card search-card">
                <section className="dashboard-section mb-0">
                  <div className="section-header-flex">
                    <h2 className="section-title">Semantic Search</h2>
                    <span className="kbd-shortcut">
                      <kbd>⌘</kbd> + <kbd>K</kbd>
                    </span>
                  </div>

                  <form className="search-bar" onSubmit={handleSearch}>
                    <div className="input-wrapper">
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Ask a question about your indexed documentation..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        disabled={loading}
                      />
                      <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                      {query && (
                        <button
                          type="button"
                          className="clear-input-btn"
                          onClick={() => setQuery('')}
                          title="Clear input"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading || !query.trim()}>
                      {loading ? 'Searching...' : 'Search Docs'}
                    </button>
                  </form>

                  {/* Suggestion Chips */}
                  <div className="chips-row">
                    <span className="chips-label">
                      {suggestionsSourceRepo ? `Questions for ${suggestionsSourceRepo}:` : 'Try asking:'}
                    </span>
                    {suggestedQueries.map((sq, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="suggestion-chip"
                        onClick={() => handleSearch(null, sq)}
                      >
                        {sq}
                      </button>
                    ))}
                  </div>

                  {/* SEARCH RESULTS DIRECTLY UNDER SEARCH BAR */}
                  {renderSearchResults()}
                </section>
              </div>
            </>
          )}

          {/* TAB 2: DEDICATED SEARCH VIEW */}
          {activeTab === 'search' && (
            <div className="panel-card main-panel">
              <section className="dashboard-section mb-0">
                <div className="section-header-flex">
                  <h2 className="section-title">Semantic Search Explorer</h2>
                  <span className="kbd-shortcut">
                    <kbd>⌘</kbd> + <kbd>K</kbd>
                  </span>
                </div>
                <p className="tab-intro">
                  Perform natural language retrieval over all documentation chunks mathematically encoded in ChromaDB.
                </p>

                <form className="search-bar" onSubmit={handleSearch}>
                  <div className="input-wrapper">
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Describe what you're looking for in your documents..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      disabled={loading}
                    />
                    <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    {query && (
                      <button
                        type="button"
                        className="clear-input-btn"
                        onClick={() => setQuery('')}
                        title="Clear query"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <button type="submit" className="btn-primary" disabled={loading || !query.trim()}>
                    {loading ? 'Searching...' : 'Search'}
                  </button>
                </form>

                {/* Filter Controls Row */}
                <div className="search-filters-bar">
                  <div className="filter-group">
                    <label>Filter by Repository:</label>
                    <select
                      className="repo-filter-select"
                      value={selectedRepoFilter}
                      onChange={(e) => setSelectedRepoFilter(e.target.value)}
                    >
                      <option value="">All Repositories</option>
                      {stats.repositories?.map((r, i) => (
                        <option key={i} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-group">
                    <label>Results Limit:</label>
                    <select
                      className="repo-filter-select"
                      value={nResults}
                      onChange={(e) => setNResults(Number(e.target.value))}
                    >
                      <option value={3}>Top 3</option>
                      <option value={5}>Top 5</option>
                      <option value={10}>Top 10</option>
                    </select>
                  </div>
                </div>

                {/* Suggestion Chips */}
                <div className="chips-row">
                  <span className="chips-label">
                    {suggestionsSourceRepo ? `Questions for ${suggestionsSourceRepo}:` : 'Popular queries:'}
                  </span>
                  {suggestedQueries.map((sq, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="suggestion-chip"
                      onClick={() => handleSearch(null, sq)}
                    >
                      {sq}
                    </button>
                  ))}
                </div>

                {/* SEARCH RESULTS DIRECTLY UNDER SEARCH BAR */}
                {renderSearchResults()}
              </section>
            </div>
          )}

          {/* TAB 3: REPOSITORY INGESTION & MANAGEMENT */}
          {activeTab === 'repository' && (
            <div className="panel-card main-panel">
              <section className="dashboard-section">
                <h2 className="section-title">Repository Management & Ingestion</h2>
                <p className="tab-intro">
                  DocuRAG connects directly to GitHub to download repositories, extract markdown and mdx files, clean them, and store dense vector embeddings locally.
                </p>

                <div className="ingest-card-inner">
                  <div className="drag-drop-zone">
                    <p className="zone-title">Any Public GitHub Repository</p>
                    <p className="zone-desc">Accepts formats like <code>tiangolo/fastapi</code> or <code>https://github.com/owner/repo</code></p>
                  </div>

                  <div className="ingest-form-wrapper">
                    <label className="input-label">Repository URL or Shorthand</label>
                    <input
                      type="text"
                      className="repo-input"
                      placeholder="e.g. tiangolo/fastapi"
                      value={ingestUrl}
                      onChange={(e) => setIngestUrl(e.target.value)}
                      disabled={ingesting}
                    />

                    <div className="preset-buttons-row">
                      <span className="preset-label">Quick Presets:</span>
                      {PRESET_REPOS.map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="preset-chip"
                          disabled={ingesting}
                          onClick={() => {
                            setIngestUrl(preset.name)
                            handleIngest(null, preset.name)
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={handleIngest}
                      className="btn-primary full-width"
                      disabled={ingesting || !ingestUrl.trim()}
                    >
                      {ingesting ? 'Processing Ingestion...' : 'Ingest Repository'}
                    </button>
                    {ingestError && <div className="error-text mt-2">{ingestError}</div>}
                  </div>
                </div>
              </section>

              {/* Repositories currently indexed */}
              <section className="dashboard-section mb-0">
                <h3 className="section-title">Currently Indexed Repositories</h3>
                {stats.repositories && stats.repositories.length > 0 ? (
                  <div className="repo-cards-grid">
                    {stats.repositories.map((repo, idx) => (
                      <div key={idx} className="repo-stat-card">
                        <div className="repo-card-header">
                          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                          </svg>
                          <h4>{repo}</h4>
                        </div>
                        <p className="repo-card-meta">Persistent in ChromaDB</p>
                        <div className="repo-card-actions">
                          <button
                            type="button"
                            className="btn-outline-sm"
                            onClick={() => {
                              setSelectedRepoFilter(repo)
                              setActiveTab('search')
                            }}
                          >
                            Search This Repo
                          </button>
                          <a
                            href={`https://github.com/${repo}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-outline-sm"
                          >
                            View on GitHub ↗
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-results">
                    <p className="empty-title">No repositories currently indexed</p>
                    <p className="empty-desc">Use the form above or pick one of the quick presets to index your first repository.</p>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB 4: ARCHITECTURE & DOCS VIEW */}
          {activeTab === 'docs' && (
            <div className="panel-card main-panel">
              <section className="dashboard-section">
                <h2 className="section-title">DocuRAG Architecture & Technical Design</h2>
                <p className="tab-intro">
                  DocuRAG is an end-to-end open source semantic documentation engine designed for local, zero-cost AI retrieval.
                </p>

                <div className="architecture-grid">
                  <div className="arch-step-card">
                    <div className="arch-step-number">1</div>
                    <h4>Extraction</h4>
                    <p>
                      Downloads public repositories as compressed archives, isolates all <code>.md</code> and <code>.mdx</code> files, and filters out dependencies (such as <code>node_modules</code> and virtual environments).
                    </p>
                  </div>

                  <div className="arch-step-card">
                    <div className="arch-step-number">2</div>
                    <h4>Text Processing</h4>
                    <p>
                      Safely strips HTML tags while shielding code blocks and generic types (e.g. <code>List&lt;str&gt;</code>). Splits documents into overlapping semantic chunks with LangChain&rsquo;s <code>RecursiveCharacterTextSplitter</code>.
                    </p>
                  </div>

                  <div className="arch-step-card">
                    <div className="arch-step-number">3</div>
                    <h4>Dense Embedding</h4>
                    <p>
                      Passes chunks through HuggingFace&rsquo;s <code>all-MiniLM-L6-v2</code> neural model locally to generate 384-dimensional mathematical sentence representations with in-memory caching.
                    </p>
                  </div>

                  <div className="arch-step-card">
                    <div className="arch-step-number">4</div>
                    <h4>ChromaDB Vector Store</h4>
                    <p>
                      Upserts vector embeddings with rich file metadata into a persistent ChromaDB vector store. Performs cosine similarity queries with sub-millisecond retrieval times.
                    </p>
                  </div>
                </div>

                <div className="api-reference-box">
                  <h3>Backend API Reference</h3>
                  <div className="api-endpoints-list">
                    <div className="api-endpoint-row">
                      <span className="http-method get">GET</span>
                      <code>/health</code>
                      <span className="endpoint-desc">Health check endpoint returning system status and version.</span>
                    </div>
                    <div className="api-endpoint-row">
                      <span className="http-method get">GET</span>
                      <code>/stats</code>
                      <span className="endpoint-desc">Returns total indexed chunks and registered repositories.</span>
                    </div>
                    <div className="api-endpoint-row">
                      <span className="http-method get">GET</span>
                      <code>/search?q={'{query}'}&amp;n_results=5&amp;repo={'{repo}'}</code>
                      <span className="endpoint-desc">Performs semantic similarity search against the vector database.</span>
                    </div>
                    <div className="api-endpoint-row">
                      <span className="http-method post">POST</span>
                      <code>/ingest</code>
                      <span className="endpoint-desc">Accepts <code>{`{ "github_url": "..." }`}</code> to trigger extraction and embedding.</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App

