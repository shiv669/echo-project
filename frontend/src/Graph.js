import React, { useEffect, useRef } from 'react'; // we import react hooks for effects and refs to handle dom manipulation and side effects
import * as d3 from 'd3'; // we import d3 library which is the industry standard for data-driven visualization and complex interactive graphics
import './Graph.css'; // we import styling for graph component to keep visual concerns separated from logic

function Graph({ nodes, edges, onNodeClick }) {
  // we create a ref to the svg element where d3 will render all the graph elements like nodes links and labels
  const svgRef = useRef(null);

  // we use useEffect to render the graph whenever nodes or edges change this is where all d3 manipulation happens
  useEffect(() => {
    // we return early if no svg element or nodes exist to prevent errors when rendering empty data
    if (!svgRef.current || nodes.length === 0) return;

    // we get the dimensions of the container using client properties to ensure responsive sizing
    const width = svgRef.current.clientWidth; // we get width from the parent container element
    const height = svgRef.current.clientHeight; // we get height from the parent container element

    // we clear previous svg content to avoid duplicating elements when re-rendering data
    d3.select(svgRef.current).selectAll("*").remove(); // we completely remove all child elements

    // we create the main svg element that will hold all our visualization elements
    const svg = d3.select(svgRef.current)
      .attr('width', width) // we set the width attribute for responsive behavior
      .attr('height', height) // we set the height attribute for responsive behavior
      .attr('viewBox', [0, 0, width, height]); // we set viewBox for proper scaling on different screen sizes

    // we create a group element that we'll use to contain all graph elements for easy manipulation
    const g = svg.append('g');

    // we create a force simulation which is the core d3 algorithm that positions nodes meaningfully
    // the simulation uses physics-like forces to create a natural-looking graph layout
    const simulation = d3.forceSimulation(nodes) // we initialize the simulation with our node data
      .force('link', d3.forceLink(edges) // we add a link force that pulls connected nodes together
        .id(d => d.id) // we specify that edges reference nodes by their id property
        .distance(d => {
          // we calculate link distance based on edge weight for stronger connections to be closer together
          return d.weight ? 100 * (1 - d.weight) : 150; // we use inverse of weight so stronger connections are tighter
        })
        .strength(d => {
          // we make stronger edges have more pull to bring nodes together in a meaningful way
          return d.weight ? d.weight * 0.5 : 0.2; // we scale strength proportionally to edge weight for physical accuracy
        }))
      .force('charge', d3.forceManyBody() // we add repulsive force so nodes don't stack on top of each other
        .strength(d => {
          // we make the repulsion stronger for central nodes which have more connections this spreads them out
          const connectionCount = edges.filter(e => e.source.id === d.id || e.target.id === d.id).length;
          // we calculate repulsion based on how connected a node is to spread out high-degree nodes
          return -200 * (1 + connectionCount * 0.5); // we increase repulsion for nodes with many connections
        }))
      .force('center', d3.forceCenter(width / 2, height / 2)) // we add centering force to keep graph centered
      .force('collision', d3.forceCollide() // we add collision force to prevent nodes from overlapping
        .radius(d => {
          // we make collision radius larger for central nodes to give them more visual space
          const connectionCount = edges.filter(e => e.source.id === d.id || e.target.id === d.id).length;
          // we calculate radius proportional to node importance based on connection count
          return 30 + connectionCount * 5; // we give more space to well-connected nodes
        }));

    // we create links (edges) visual elements that represent connections between nodes
    const link = g.append('g')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line') // we append line element for each edge connection
      .attr('stroke', d => {
        // we color edges based on their strength to visualize relationship importance
        if (!d.weight) return '#ccc'; // we use light gray for weak connections
        if (d.weight > 0.7) return '#00aa44'; // we use green for strong connections (>0.7 similarity)
        if (d.weight > 0.4) return '#ffaa00'; // we use orange for medium connections
        return '#ff6666'; // we use red for weak connections
      })
      .attr('stroke-opacity', d => {
        // we make edge opacity proportional to weight so strong edges stand out more
        return Math.min(0.2 + d.weight * 0.6, 0.8); // we cap opacity at 0.8 to keep graph readable
      })
      .attr('stroke-width', d => {
        // we scale line width based on edge weight so important connections are visually thicker
        return Math.sqrt(d.weight || 0.1) * 4; // we use square root for better visual scaling
      });

    // we create nodes visual elements which are circles representing each knowledge node
    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle') // we append circle element for each node
      .attr('r', d => {
        // we calculate radius based on node importance determined by connection count
        const connectionCount = edges.filter(e => e.source.id === d.id || e.target.id === d.id).length;
        // we make more connected nodes larger to show their centrality in the knowledge graph
        return 20 + connectionCount * 2; // we scale from 20 to up to 40+ depending on connections
      })
      .attr('fill', d => {
        // we color nodes based on their role in the network using a meaningful color scheme
        const connectionCount = edges.filter(e => e.source.id === d.id || e.target.id === d.id).length;
        // we use different colors to represent hub nodes central nodes and peripheral nodes
        if (connectionCount > 5) return '#0066ff'; // we use blue for hub nodes (highly connected)
        if (connectionCount > 2) return '#00aa44'; // we use green for central nodes (moderately connected)
        return '#ff9900'; // we use orange for peripheral nodes (few connections)
      })
      .attr('stroke', d => {
        // we add stroke to make nodes stand out and help with readability
        return '#fff'; // we use white stroke for contrast
      })
      .attr('stroke-width', d => {
        // we make stroke thicker for nodes based on their importance
        const connectionCount = edges.filter(e => e.source.id === d.id || e.target.id === d.id).length;
        // we increase stroke width for important nodes to emphasize their role
        return connectionCount > 4 ? 3 : 2; // we use thicker stroke for hub nodes
      })
      .style('cursor', 'pointer') // we change cursor to pointer when hovering to indicate clickability
      .on('click', (event, d) => { // we handle click events to show node details
        event.stopPropagation(); // we stop event propagation to prevent unwanted bubbling
        onNodeClick(d.id); // we call the callback function with node id to show node details
      })
      .on('mouseover', function(event, d) { // we handle mouse over for visual feedback
        // we highlight the hovered node by increasing its opacity and making it glow
        d3.select(this) // we select the current node being hovered
          .transition() // we smoothly animate the change
          .duration(200) // we use 200ms for quick responsive feedback
          .attr('r', dd => {
            // we increase radius on hover for visual feedback
            const connectionCount = edges.filter(e => e.source.id === dd.id || e.target.id === dd.id).length;
            // we grow the node based on its original size plus 8 pixels
            return 28 + connectionCount * 2; // we make it 8 pixels larger
          });
        
        // we also highlight the edges connected to this node to show relationships
        link.style('stroke-opacity', l => {
          // we increase opacity of connected edges and decrease others for clarity
          if (l.source.id === d.id || l.target.id === d.id) return 0.8; // we highlight connected edges
          return 0.1; // we dim other edges for focus
        });
      })
      .on('mouseout', function(event, d) { // we handle mouse out to reset highlights
        // we reset the node to its original size smoothly
        d3.select(this) // we select the current node
          .transition() // we smoothly animate back
          .duration(200) // we use 200ms for consistent animation
          .attr('r', dd => {
            // we return to original radius
            const connectionCount = edges.filter(e => e.source.id === dd.id || e.target.id === dd.id).length;
            // we calculate original size
            return 20 + connectionCount * 2; // we return to normal size
          });
        
        // we reset all edge opacities to normal
        link.style('stroke-opacity', l => {
          // we restore opacity based on weight for all edges
          return Math.min(0.2 + (l.weight || 0.1) * 0.6, 0.8); // we restore normal opacity
        });
      })
      .call(drag(simulation)); // we attach drag behavior to enable node dragging

    // we create labels for nodes to show node IDs or titles for readability
    const labels = g.append('g')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text') // we append text element for each node label
      .attr('text-anchor', 'middle') // we center text horizontally on the node
      .attr('dy', '.35em') // we align text vertically in the center of the node
      .attr('font-size', d => {
        // we make font size proportional to node importance for visual hierarchy
        const connectionCount = edges.filter(e => e.source.id === d.id || e.target.id === d.id).length;
        // we scale font size to match node importance
        return connectionCount > 4 ? '14px' : '12px'; // we make hub nodes text larger
      })
      .attr('fill', '#000') // we use black text for readability on colored backgrounds
      .attr('pointer-events', 'none') // we disable mouse events on text so clicks pass through to nodes
      .text(d => d.id); // we display node id as the label text

    // we update positions on each tick of the simulation to animate node movement
    simulation.on('tick', () => {
      // we update link positions to connect from source to target nodes following their movement
      link
        .attr('x1', d => d.source.x) // we set x1 to source node x coordinate
        .attr('y1', d => d.source.y) // we set y1 to source node y coordinate
        .attr('x2', d => d.target.x) // we set x2 to target node x coordinate
        .attr('y2', d => d.target.y); // we set y2 to target node y coordinate

      // we update node positions as they move according to simulation forces
      node
        .attr('cx', d => d.x) // we set node center x
        .attr('cy', d => d.y); // we set node center y

      // we update label positions to follow nodes keeping labels centered on nodes
      labels
        .attr('x', d => d.x) // we set label x to match node x
        .attr('y', d => d.y); // we set label y to match node y
    });

    // we implement zoom and pan functionality for exploring large graphs
    const zoom = d3.zoom() // we create zoom behavior for mouse wheel interaction
      .on('zoom', (event) => {
        // we apply the zoom transform to scale and pan the graph
        g.attr('transform', event.transform); // we apply scale and translate transformation
      });

    svg.call(zoom); // we attach zoom behavior to svg for user interaction

    // we cleanup function to stop simulation when component unmounts to prevent memory leaks
    return () => {
      simulation.stop(); // we stop the force simulation to free resources and stop calculations
    };
  }, [nodes, edges, onNodeClick]); // we re-run effect when nodes edges or callback changes

  // we implement drag behavior for nodes allowing users to manually position them
  function drag(simulation) {
    // we define drag event handlers for different phases of dragging
    function dragstarted(event, d) {
      // we handle drag start by restarting the simulation with reduced alpha for smoother movement
      if (!event.active) simulation.alphaTarget(0.3).restart(); // we restart simulation if not already active
      d.fx = d.x; // we fix node x position during drag to follow mouse
      d.fy = d.y; // we fix node y position during drag to follow mouse
    }

    function dragged(event, d) {
      // we handle active dragging by updating the fixed position to follow mouse movement
      d.fx = event.x; // we update fixed x position to current mouse x
      d.fy = event.y; // we update fixed y position to current mouse y
    }

    function dragended(event, d) {
      // we handle drag end by releasing the node and letting forces take over again
      if (!event.active) simulation.alphaTarget(0); // we stop forcing animation if no other active dragging
      d.fx = null; // we release node x position to allow forces again
      d.fy = null; // we release node y position to allow forces again
    }

    // we return drag behavior with all the handlers attached for interactive positioning
    return d3.drag()
      .on('start', dragstarted) // we call dragstarted when drag begins
      .on('drag', dragged) // we call dragged during dragging
      .on('end', dragended); // we call dragended when drag ends
  }

  return (
    <div className="graph-container"> {/* main container div for graph component */}
      <svg ref={svgRef} className="graph-svg"></svg> {/* we render svg element that d3 will use for all visualization */}
      <div className="graph-legend"> {/* we add legend to explain the graph visualization */}
        <div className="legend-item"> {/* we show hub node explanation */}
          <span className="legend-color hub"></span>
          <span className="legend-text">Hub Nodes - Highly connected central concepts</span>
        </div>
        <div className="legend-item"> {/* we show central node explanation */}
          <span className="legend-color central"></span>
          <span className="legend-text">Central Nodes - Moderately connected concepts</span>
        </div>
        <div className="legend-item"> {/* we show peripheral node explanation */}
          <span className="legend-color peripheral"></span>
          <span className="legend-text">Peripheral Nodes - Few connections</span>
        </div>
        <div className="legend-info"> {/* we add interaction instructions */}
          <p>💡 Click nodes for details | Drag to move | Scroll to zoom | Green edges = Strong connections</p>
        </div>
      </div>
    </div>
  );
}

export default Graph;
