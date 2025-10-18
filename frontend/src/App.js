import React, { useState, useEffect } from 'react'; // we import react hooks for state management and lifecycle
import Graph from './Graph'; // we import our graph component for visualization
import './App.css'; // we import styling for our app

function App() {
  // we maintain state for nodes that we fetch from backend
  const [nodes, setNodes] = useState([]);
  
  // we maintain state for edges that represent connections between nodes
  const [edges, setEdges] = useState([]);
  
  // we maintain state for the input repository url
  const [repoUrl, setRepoUrl] = useState('');
  
  // we maintain state for custom text snippet input
  const [textSnippet, setTextSnippet] = useState('');
  
  // we maintain state for title of the source being added
  const [title, setTitle] = useState('');
  
  // we maintain state for loading indicator while fetching from backend
  const [loading, setLoading] = useState(false);
  
  // we maintain state for any error messages that occur during operations
  const [error, setError] = useState('');
  
  // we maintain state for success message when source is added
  const [successMessage, setSuccessMessage] = useState('');
  
  // we maintain state for currently selected node to show details
  const [selectedNode, setSelectedNode] = useState(null);

  // this backend url is where our fastapi server is running
  const BACKEND_URL = 'http://localhost:8000';

  // we use useEffect hook to fetch nodes when component mounts
  useEffect(() => {
    fetchNodes(); // we call fetch nodes on initial load
  }, []); // empty dependency array means this runs only once on mount

  const fetchNodes = async () => {
    // this function fetches all nodes from the backend api
    try {
      setLoading(true); // we set loading to true while fetching
      setError(''); // we clear any previous errors
      
      // we make a get request to the backend to fetch all nodes
      const response = await fetch(`${BACKEND_URL}/get_nodes?limit=50`);
      
      if (!response.ok) { // if response status is not 2xx
        throw new Error('Failed to fetch nodes'); // we throw error
      }
      
      // we parse the json response from backend
      const data = await response.json();
      
      // we update our state with fetched nodes and edges
      setNodes(data.nodes); // we set the nodes array
      setEdges(data.edges); // we set the edges array for graph connections
      
      setLoading(false); // we set loading to false when done
    } catch (err) {
      console.error('Error fetching nodes:', err); // we log error to console
      setError('Failed to fetch knowledge nodes. Make sure backend is running.'); // we set error message
      setLoading(false); // we set loading to false
    }
  };

  const handleAddSource = async (e) => {
    // this function handles adding a new source (github repo or text snippet)
    e.preventDefault(); // we prevent default form submission behavior
    
    // we validate that at least one input is provided
    if (!repoUrl && !textSnippet) {
      setError('Please enter a GitHub URL or text content'); // we show error if both empty
      return;
    }

    try {
      setLoading(true); // we set loading indicator
      setError(''); // we clear previous errors
      setSuccessMessage(''); // we clear previous success messages

      // we construct the query parameters for the backend request
      const params = new URLSearchParams();
      if (repoUrl) params.append('repo_url', repoUrl); // we add repo url if provided
      if (textSnippet) params.append('text_snippet', textSnippet); // we add text snippet if provided
      if (title) params.append('title', title); // we add title if provided

      // we make a post request to add the source
      const response = await fetch(`${BACKEND_URL}/add_source?${params}`, {
        method: 'POST', // we use post method for creating new resource
        headers: {
          'Content-Type': 'application/json', // we specify json content type
        },
      });

      if (!response.ok) { // if response is not successful
        const errorData = await response.json(); // we parse error details
        throw new Error(errorData.detail || 'Failed to add source'); // we throw error
      }

      // we parse the response to get the newly added node
      const newNode = await response.json();

      // we show success message
      setSuccessMessage(`Successfully added: ${newNode.title}`);

      // we clear the input fields after successful addition
      setRepoUrl(''); // we clear repo url field
      setTextSnippet(''); // we clear text snippet field
      setTitle(''); // we clear title field

      // we fetch nodes again to refresh the graph with new data
      await fetchNodes();

      setLoading(false); // we set loading to false
    } catch (err) {
      console.error('Error adding source:', err); // we log error
      setError(err.message || 'Failed to add source'); // we show error message
      setLoading(false); // we set loading to false
    }
  };

  const handleNodeClick = async (nodeId) => {
    // this function handles when user clicks on a node in the graph for detailed view
    try {
      // we fetch the specific node details from backend
      const response = await fetch(`${BACKEND_URL}/get_node/${nodeId}`);
      
      if (!response.ok) { // if response is not successful
        throw new Error('Failed to fetch node details'); // we throw error
      }
      
      // we parse the node data
      const nodeData = await response.json();
      
      // we log the node data for debugging purposes to see what we got from backend
      console.log("we received node data from backend:", nodeData);
      console.log("we check summary structure:", nodeData.summary);
      
      // we set the selected node to show in details panel
      setSelectedNode(nodeData);
    } catch (err) {
      console.error('Error fetching node details:', err); // we log error
      setError('Failed to fetch node details'); // we show error message
    }
  };

  return (
    <div className="app-container"> {/* main container for entire app */}
      <header className="app-header">
        <h1>🔊 ECHO - Collective Memory of Humanity</h1>
        <p>Building the collective knowledge graph through open source intelligence</p>
      </header>

      <div className="app-content">
        <aside className="sidebar">
          <section className="input-section">
            <h2>Add Knowledge Source</h2>
            
            {/* we show error message if any error occurs */}
            {error && <div className="error-message">{error}</div>}
            
            {/* we show success message if source is added successfully */}
            {successMessage && <div className="success-message">{successMessage}</div>}

            <form onSubmit={handleAddSource}> {/* we create form for adding source */}
              <div className="form-group">
                <label htmlFor="title">Source Title (Optional)</label>
                <input
                  id="title"
                  type="text"
                  placeholder="e.g., PySyft Privacy Framework"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)} // we update title state on input change
                />
              </div>

              <div className="form-group">
                <label htmlFor="repoUrl">GitHub Repository URL</label>
                <input
                  id="repoUrl"
                  type="url"
                  placeholder="https://github.com/OpenMined/PySyft"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)} // we update repo url on input change
                />
              </div>

              <div className="divider">OR</div>

              <div className="form-group">
                <label htmlFor="textSnippet">Text Content</label>
                <textarea
                  id="textSnippet"
                  placeholder="Paste knowledge content here..."
                  value={textSnippet}
                  onChange={(e) => setTextSnippet(e.target.value)} // we update text snippet on input change
                  rows="6"
                />
              </div>

              <button type="submit" disabled={loading}> {/* we disable button while loading */}
                {loading ? 'Adding...' : 'Add Source'} {/* we show different text based on loading state */}
              </button>
            </form>
          </section>

          {/* we show node details panel when a node is selected */}
          {selectedNode && (
            <section className="node-details">
              <h3>Node Details</h3>
              <h4>{selectedNode.title}</h4>
              
              <div className="detail-group">
                <label>Source:</label>
                <a href={selectedNode.source} target="_blank" rel="noopener noreferrer">
                  {selectedNode.source_type === 'github' ? '🔗 GitHub' : 'Direct Input'}
                </a>
              </div>

              {/* we display key concepts from the summary */}
              {selectedNode.summary && selectedNode.summary.key_concepts && (
                <div className="detail-group">
                  <label>Key Concepts:</label>
                  <div className="tags">
                    {selectedNode.summary.key_concepts.map((concept, idx) => {
                      // we render each concept as a tag
                      return <span key={idx} className="tag">{concept}</span>;
                    })}
                  </div>
                </div>
              )}

              {/* we display methods used from summary */}
              {selectedNode.summary && selectedNode.summary.methods_used && (
                <div className="detail-group">
                  <label>Methods Used:</label>
                  <div className="tags">
                    {selectedNode.summary.methods_used.map((method, idx) => (
                      <span key={idx} className="tag method">{method}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* we display insights from summary */}
              {selectedNode.summary && selectedNode.summary.insights && (
                <div className="detail-group">
                  <label>Insights:</label>
                  <p>{selectedNode.summary.insights}</p>
                </div>
              )}

              <button onClick={() => setSelectedNode(null)} className="close-btn">Close</button> {/* we close details on button click */}
            </section>
          )}
        </aside>

        <main className="graph-section">
          {/* we show loading spinner while fetching data */}
          {loading && <div className="loading">Loading knowledge nodes...</div>}
          
          {/* we render graph component with nodes and edges, passing click handler for node selection */}
          {!loading && nodes.length > 0 && (
            <Graph 
              nodes={nodes} 
              edges={edges} 
              onNodeClick={handleNodeClick} // we pass the click handler to graph component
            />
          )}
          
          {/* we show empty state if no nodes exist */}
          {!loading && nodes.length === 0 && (
            <div className="empty-state">
              <p>No knowledge nodes yet. Add your first source to get started!</p>
            </div>
          )}
        </main>
      </div>

      <footer className="app-footer">
        <p>🧠 ECHO: Building the collective memory through open knowledge</p>
        <p>Backend: http://localhost:8000 | Frontend: React + D3.js</p>
      </footer>
    </div>
  );
}

export default App;
