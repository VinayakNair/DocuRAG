import { useState, useEffect } from 'react'
import './App.css'

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
  const maxProgress = 15; // Hardcoded fake max file count for the animation
  const [currentFile, setCurrentFile] = useState('README.md');

  const FAKE_FILES = ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'docs/index.md', 'docs/advanced.md', 'src/api.py', 'src/models.py'];

  const PIPELINE_STEPS = [
    { title: "Extraction Layer", desc: "Fetching markdown files from GitHub", side: "right" },
    { title: "Processing Layer", desc: "Cleaning and chunking text", side: "left" },
    { title: "Ingestion Layer", desc: "Generating and upserting embeddings", side: "right" }
  ];

  useEffect(() => {
    let interval;
    let fileInterval;
    
    if (ingesting) {
      // Step incrementer (0 -> 1 -> 2)
      interval = setInterval(() => {
        setActiveStep((prev) => (prev < 3 ? prev + 1 : prev));
      }, 4000); // 4 seconds per step
      
      // Fake progress incrementer for the terminal block
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
      const response = await fetch(`http://localhost:8000/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_url: ingestUrl })
      })
      const data = await response.json()
      
      if (data.chunks_processed && data.chunks_processed > 0) {
        setActiveStep(3); // force fill all steps
        setProgressCount(15);
        setIngestionComplete(true)
        setIngestMetrics({
          repo: ingestUrl.split("/").pop(),
          chunks: data.chunks_processed
        })
        setIngestUrl('')
      } else {
        setIngestError(data.message)
        // Reset state on actual fail
        setIngesting(false)
        setActiveStep(0)
      }
    } catch (error) {
      console.error("Failed to ingest:", error)
      setIngestError("Failed to ingest repository. API might be down.")
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
      const response = await fetch(`http://localhost:8000/search?q=${encodeURIComponent(query)}&n_results=5`)
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
    <>
      <div className="bg-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
      </div>

      <div className="app-container">
        <header className="header">
          <h1>DocuRAG</h1>
          <p>Instant semantic search across your complex technical documentation and repositories.</p>
        </header>

        <div className="forms-container">
          
          {/* 1. INGEST FORM */}
          <div className="ingest-section">
            <h3 className="section-title">Step 1: Ingest Repository</h3>
            <form className="ingest-box" onSubmit={handleIngest}>
              <svg className="ingest-icon-svg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <input
                type="text"
                className="ingest-input"
                placeholder="https://github.com/owner/repository"
                value={ingestUrl}
                onChange={(e) => setIngestUrl(e.target.value)}
                disabled={ingesting && !ingestionComplete}
              />
              <button type="submit" className="ingest-button" disabled={(ingesting && !ingestionComplete) || !ingestUrl.trim()}>
                {(ingesting && !ingestionComplete) ? 'Processing...' : 'Ingest Repo'}
              </button>
            </form>

            {/* Ingestion Error */}
            {ingestError && <div className="ingest-message error">{ingestError}</div>}

            {/* Pipeline Status Timeline / Metrics */}
            {(ingesting || ingestionComplete) && !ingestError && (
              <div className="pipeline-status-card">
                <h3 className="pipeline-title">Pipeline Status</h3>
                
                <div className="timeline">
                  {PIPELINE_STEPS.map((step, idx) => {
                    const isCompleted = activeStep > idx;
                    const isActive = activeStep === idx;
                    
                    return (
                      <div key={idx} className={`timeline-step ${step.side} ${isCompleted || isActive ? 'active' : 'pending'}`}>
                        <div className={`timeline-icon ${(isCompleted || isActive) ? 'checked' : ''}`}>
                          {(isCompleted || isActive) ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          ) : (
                            <span style={{width:"8px", height:"8px", borderRadius:"50%", background:"rgba(255,255,255,0.5)"}}></span>
                          )}
                        </div>
                        <div className="step-card">
                          <div className={`step-title ${isActive ? 'pulsing' : ''}`}>{step.title}</div>
                          <div className="step-desc">{step.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="terminal-box">
                  <div className="terminal-success">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>
                      {ingestionComplete 
                        ? `Successfully ingested. Database updated with ${ingestMetrics?.chunks || 0} chunks.` 
                        : `Successfully queued chunks. Worker processing...`}
                    </span>
                  </div>
                  
                  <div className="progress-header">
                    <span>Progress</span>
                    <span>{Math.min(progressCount, maxProgress)} / {maxProgress}</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${(Math.min(progressCount, maxProgress) / maxProgress) * 100}%` }}></div>
                  </div>
                  
                  <div className="processing-file">
                    Processing: {ingestionComplete ? 'Complete' : currentFile}
                  </div>
                </div>

              </div>
            )}
          </div>

          <div className="section-divider"></div>

          {/* 2. SEARCH FORM */}
          <div className={`search-section ${(!ingestionComplete && !hasSearched) ? 'dimmed' : ''}`}>
            <h3 className="section-title">Step 2: Semantic Search</h3>
            <form className="search-box" onSubmit={handleSearch}>
              <svg className="search-icon-svg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                className="search-input"
                placeholder="Ask a question about the repositories..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
              />
              <button type="submit" className="search-button" disabled={loading || !query.trim()}>
                {loading ? 'Searching...' : 'Search'}
              </button>
            </form>
          </div>
        </div>

        {/* RESULTS AREA */}
        <div className="state-container">
          {loading && (
            <div className="loading">
              <div className="spinner"></div>
              <span>Searching knowledge base...</span>
            </div>
          )}

          {!loading && hasSearched && results.length === 0 && (
            <div className="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2>No results found</h2>
              <p>Try rephrasing your search query to find relevant documentation.</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="results-grid">
              {results.map((result, idx) => (
                <div key={idx} className="result-card" style={{animationDelay: `${idx * 0.1}s`}}>
                  <div className="meta-header">
                    <span className="source-badge">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{marginRight: '6px'}}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {result.repository}/{result.source}
                    </span>
                    <span className="chunk-badge">Idx: {result.chunk_index}</span>
                  </div>
                  <div className="result-text">
                    {formatText(result.text)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default App
