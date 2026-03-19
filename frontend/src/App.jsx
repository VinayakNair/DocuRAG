import { useState, useEffect } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [query, setQuery] = useState('')
  const [ingestUrl, setIngestUrl] = useState('')
  const [results, setResults] = useState([])
  
  const [loading, setLoading] = useState(false)
  
  // Ingestion States
  const [ingesting, setIngesting] = useState(false)
  const [ingestionComplete, setIngestionComplete] = useState(false)
  const [ingestMetrics, setIngestMetrics] = useState(null)
  
  const [hasSearched, setHasSearched] = useState(false)
  const [ingestError, setIngestError] = useState(null)

  // Pipeline Status UI state
  const [activeStep, setActiveStep] = useState(0);
  const [progressCount, setProgressCount] = useState(0);
  const maxProgress = 15;
  const [currentFile, setCurrentFile] = useState('README.md');

  const FAKE_FILES = ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'docs/index.md', 'docs/advanced.md', 'src/api.py', 'src/models.py'];

  const PIPELINE_STEPS = [
    { title: "Extraction", desc: "Fetching markdown files from GitHub", side: "left" },
    { title: "Processing", desc: "Cleaning and chunking text", side: "right" },
    { title: "Ingestion", desc: "Generating and upserting embeddings", side: "left" }
  ];

  useEffect(() => {
    let interval;
    let fileInterval;
    
    if (ingesting) {
      interval = setInterval(() => {
        setActiveStep((prev) => (prev < 3 ? prev + 1 : prev));
      }, 4000); 
      
      fileInterval = setInterval(() => {
        setProgressCount(prev => {
          if (prev < maxProgress) return prev + 1;
          return prev;
        });
        setCurrentFile(FAKE_FILES[Math.floor(Math.random() * FAKE_FILES.length)]);
      }, 700);

    } else {
      setActiveStep(0);
      setProgressCount(0);
      setCurrentFile('');
    }
    
    return () => {
      clearInterval(interval);
      clearInterval(fileInterval);
    };
  }, [ingesting]);


  const handleIngest = async (e) => {
    e.preventDefault()
    if (!ingestUrl.trim()) return

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
        body: JSON.stringify({ github_url: ingestUrl })
      })
      const data = await response.json()
      
      if (data.chunks_processed && data.chunks_processed > 0) {
        setActiveStep(3); 
        setProgressCount(15);
        setIngestionComplete(true)
        setIngestMetrics({
          repo: ingestUrl.split("/").pop(),
          chunks: data.chunks_processed
        })
        setIngestUrl('')
      } else {
        setIngestError(data.message)
        setIngesting(false)
        setActiveStep(0)
      }
    } catch (error) {
      console.error("Failed to ingest:", error)
      setIngestError("Failed to connect to backend API limit.")
      setIngesting(false)
      setActiveStep(0)
    }
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setHasSearched(true)
    
    try {
      const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&n_results=5`)
      const data = await response.json()
      setResults(data.results || [])
    } catch (error) {
      console.error("Failed to fetch results:", error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const formatText = (text) => {
    if (text.length > 500) text = text.substring(0, 500) + '...';
    return text.split(/(```[\s\S]*?```|`[^`]+`)/g).map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        return <pre key={i} className="code-block"><code>{part.replace(/```/g, '')}</code></pre>
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="inline-code">{part.replace(/`/g, '')}</code>
      }
      return <span key={i}>{part}</span>
    });
  }

  return (
    <div className="layout">
      {/* Background Orbs */}
      <div className="bg-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
      </div>

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <svg viewBox="0 0 24 24" fill="none" className="logo-icon" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <nav className="sidebar-nav">
          <button className="nav-btn active">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          </button>
          <button className="nav-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </button>
          <button className="nav-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          </button>
          <button className="nav-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          </button>
        </nav>
      </aside>

      <main className="main-content">
        
        {/* Top Navbar */}
        <header className="top-nav">
          <div className="title">
            <span className="brand-primary">Docu</span><span className="brand-secondary">RAG</span>
          </div>
          <div className="top-pills">
            <div className="pill-nav">
              <button className="active">Dashboard</button>
              <button>Search</button>
              <button>Repository</button>
              <button>Docs</button>
            </div>
            <button className="profile-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              Profile
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="dashboard-grid">
          
          <div className="glass-panel main-panel">
            
            {/* SEMANTIC SEARCH SECTION */}
            <section className="dashboard-section">
              <h2 className="section-title">Semantic Search</h2>
              <form className="search-bar" onSubmit={handleSearch}>
                <div className="input-wrapper">
                  <input
                    type="text"
                    placeholder="Describe what you are looking for in your documents..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={loading}
                  />
                  <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
                <button type="submit" className="btn-primary purple-btn" disabled={loading || !query.trim()}>
                  {loading ? 'Searching...' : 'Search Docs'}
                </button>
              </form>
            </section>

            {/* REPOSITORY INGESTION SECTION */}
            <section className="dashboard-section ingestion-container">
              <h2 className="section-title">Repository Ingestion</h2>
              
              <div className="ingest-card-inner">
                <div className="drag-drop-zone">
                  <div className="file-icons">
                    <span className="file-badge red">PDF</span>
                    <span className="file-badge blue">DOCX</span>
                    <span className="file-badge green">MD</span>
                  </div>
                  <p>Or ingest remote GitHub folder</p>
                </div>
                
                <div className="ingest-form-wrapper">
                  <label className="input-label">Repository URL</label>
                  <input
                    type="text"
                    className="repo-input"
                    placeholder="e.g. tiangolo/fastapi"
                    value={ingestUrl}
                    onChange={(e) => setIngestUrl(e.target.value)}
                    disabled={ingesting}
                  />
                  <button onClick={handleIngest} className="btn-primary purple-btn full-width" disabled={ingesting || !ingestUrl.trim()}>
                    {ingesting ? 'Processing...' : 'Ingest Files'}
                  </button>
                  {ingestError && <div className="error-text mt-2">{ingestError}</div>}
                </div>
              </div>
            </section>
            
            {/* TIMELINE UI overlay when ingesting */}
            {(ingesting || ingestionComplete) && !ingestError && (
              <section className="dashboard-section">
                <div className="pipeline-glass-card">
                  <h3 className="pipeline-header">PIPELINE STATUS</h3>
                  
                  <div className="vertical-timeline">
                    {PIPELINE_STEPS.map((step, idx) => {
                      const isCompleted = activeStep > idx;
                      const isActive = activeStep === idx;
                      
                      return (
                        <div key={idx} className={`timeline-node ${step.side} ${isCompleted || isActive ? 'active' : ''}`}>
                          <div className={`node-icon ${isCompleted || isActive ? 'completed' : ''}`}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </div>
                          <div className="node-content">
                            <h4>{step.title}</h4>
                            <p>{isCompleted ? 'Finished' : (isActive ? 'Processing...' : 'Pending')}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="terminal-monitor">
                    <div className="terminal-header">CURRENT STAGE: {activeStep < 3 ? PIPELINE_STEPS[activeStep].title : 'Complete'}</div>
                    <div className="terminal-progress-bar">
                      <div className="terminal-progress-fill" style={{ width: `${(Math.min(progressCount, maxProgress) / maxProgress) * 100}%` }}></div>
                    </div>
                    <div className="terminal-logs">
                      {!ingestionComplete ? (
                        <>
                          <div>Loading...</div>
                          <div className="log-line">&gt; Analyzing remaining data chunks...</div>
                          <div className="log-line">&gt; Parsing document: {currentFile} ({Math.floor((progressCount/maxProgress)*100)}% complete)...</div>
                        </>
                      ) : (
                        <div className="success-log">
                          <svg viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="#10b981" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          Success! Ingested {ingestMetrics?.chunks || 0} chunks from {ingestMetrics?.repo}.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

          </div>

          {/* RESULTS AREA */}
          {hasSearched && (
            <div className="glass-panel results-panel">
               <div className="results-header">
                  <h2 className="section-title mb-0">Search Results</h2>
               </div>
              
              {loading && (
                <div className="loading-spinner">
                  <div className="spinner"></div>
                  <span>Searching knowledge base...</span>
                </div>
              )}

              {!loading && results.length === 0 && (
                <div className="empty-results">
                  <p>No results found. Try rephrasing your search query.</p>
                </div>
              )}

              {!loading && results.length > 0 && (
                <div className="results-list">
                  {results.map((result, idx) => (
                    <div key={idx} className="result-item" style={{animationDelay: `${idx * 0.1}s`}}>
                      <div className="result-meta">
                        <span className="badge repository">{result.repository}</span>
                        <span className="badge source">{result.source}</span>
                      </div>
                      <div className="result-body">
                        {formatText(result.text)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}

export default App
