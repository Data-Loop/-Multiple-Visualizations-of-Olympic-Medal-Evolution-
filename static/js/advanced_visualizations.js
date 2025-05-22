// Advanced Olympic Data Visualizations

// Global variables
let heatmapData = null;
let sankeyData = null;

// DOM elements
let medalTypeHeatmap, yearRangeHeatmap, countryCount, clusterToggle;
let medalTypeSankey, flowType, nodeLimitSankey;

// Initialize on document ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if D3 Sankey plugin is available
    if (typeof d3.sankey !== 'function') {
        console.error('D3 Sankey plugin not loaded');
        document.getElementById('sankeyContainer').innerHTML = '<div class="alert alert-danger">Required visualization library not loaded. Please refresh the page or check the console for more information.</div>';
        return;
    }
    
    // Get DOM elements for controls
    medalTypeHeatmap = document.getElementById('medalTypeHeatmap');
    yearRangeHeatmap = document.getElementById('yearRangeHeatmap');
    countryCount = document.getElementById('countryCount');
    clusterToggle = document.getElementById('clusterToggle');
    
    medalTypeSankey = document.getElementById('medalTypeSankey');
    flowType = document.getElementById('flowType');
    nodeLimitSankey = document.getElementById('nodeLimitSankey');
    
    // Set up event listeners with force reload
    medalTypeHeatmap.addEventListener('change', function() {
        heatmapData = null; // Clear existing data
        loadHeatmapData();
    });
    
    yearRangeHeatmap.addEventListener('change', function() {
        heatmapData = null; // Clear existing data
        loadHeatmapData();
    });
    
    countryCount.addEventListener('change', loadHeatmapData);
    clusterToggle.addEventListener('change', updateHeatmap);
    
    medalTypeSankey.addEventListener('change', function() {
        sankeyData = null; // Clear existing data
        loadSankeyData();
    });
    
    flowType.addEventListener('change', function() {
        sankeyData = null; // Clear existing data
        loadSankeyData();
    });
    
    nodeLimitSankey.addEventListener('change', loadSankeyData);
    
    // Load initial data
    loadHeatmapData();
    // Load Sankey data after a short delay to ensure all DOM elements are fully initialized
    setTimeout(loadSankeyData, 100);
});

// Load heatmap data from API
function loadHeatmapData() {
    // Show loading indicator
    document.getElementById('heatmapContainer').innerHTML = '<div class="d-flex justify-content-center align-items-center" style="height: 500px;"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
    
    // Get selected values from controls
    const medalType = medalTypeHeatmap.value;
    const yearRange = yearRangeHeatmap.value;
    const countryLimit = countryCount.value;
    
    // Log request parameters for debugging
    console.log('Loading heatmap data with parameters:', { medalType, yearRange, countryLimit });
    
    // Fetch data from API with proper parameter encoding
    const url = `/api/sport-country-matrix?medal_type=${encodeURIComponent(medalType)}&year_range=${encodeURIComponent(yearRange)}&country_count=${encodeURIComponent(countryLimit)}`;
    console.log('Fetching from URL:', url);
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Received heatmap data:', data);
            // Store data globally
            heatmapData = data;
            
            // Create visualization
            createHeatmap();
        })
        .catch(error => {
            console.error('Error loading heatmap data:', error);
            document.getElementById('heatmapContainer').innerHTML = `<div class="alert alert-danger">Error loading data: ${error.message}. Please try again later.</div>`;
        });
}

// Create medal matrix heatmap
function createHeatmap() {
    if (!heatmapData) return;
    
    // Clear container
    document.getElementById('heatmapContainer').innerHTML = '';
    
    // Apply clustering if enabled
    const applyCluster = clusterToggle.checked;
    
    // Set up dimensions
    const margin = {top: 70, right: 30, bottom: 100, left: 120};
    const width = 1000 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;
    
    // Create SVG container
    const svg = d3.select('#heatmapContainer')
        .append('svg')
        .attr('width', '100%')
        .attr('height', height + margin.top + margin.bottom)
        .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Get unique countries and sports, ordered by clustering if enabled
    const countries = heatmapData.countries;
    const sports = heatmapData.sports;
    
    // Create scales
    const xScale = d3.scaleBand()
        .domain(sports)
        .range([0, width])
        .padding(0.05);
    
    const yScale = d3.scaleBand()
        .domain(countries)
        .range([0, height])
        .padding(0.05);
    
    // Color scale for medal counts
    const colorScale = d3.scaleSequential()
        .interpolator(d3.interpolateYlOrRd)
        .domain([0, heatmapData.max_value]);
    
    // Draw heatmap cells
    svg.selectAll()
        .data(heatmapData.data)
        .enter()
        .append('rect')
        .attr('x', d => xScale(d.sport))
        .attr('y', d => yScale(d.country))
        .attr('width', xScale.bandwidth())
        .attr('height', yScale.bandwidth())
        .style('fill', d => d.value === 0 ? '#f5f5f5' : colorScale(d.value))
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.5)
        .on('mouseover', function(event, d) {
            // Highlight cell
            d3.select(this)
                .classed('cell-hover', true)
                .attr('stroke', '#000')
                .attr('stroke-width', 1);
            
            // Show tooltip
            const tooltip = d3.select('body')
                .append('div')
                .attr('class', 'tooltip')
                .style('opacity', 0)
                .style('position', 'absolute')
                .style('padding', '10px')
                .style('background', 'rgba(0, 0, 0, 0.8)')
                .style('color', 'white')
                .style('border-radius', '5px')
                .style('pointer-events', 'none');
            
            tooltip.transition()
                .duration(200)
                .style('opacity', 0.9);
            
            tooltip.html(`
                <strong>${d.country_name}</strong> in <strong>${d.sport}</strong><br>
                Medals: ${d.value}
            `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function() {
            // Remove highlight
            d3.select(this)
                .classed('cell-hover', false)
                .attr('stroke', '#fff')
                .attr('stroke-width', 0.5);
            
            // Remove tooltip
            d3.selectAll('.tooltip').remove();
        });
    
    // Draw x-axis for sports
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .style('font-size', '10px');
    
    // Draw y-axis for countries
    svg.append('g')
        .call(d3.axisLeft(yScale))
        .selectAll('text')
        .text(d => {
            // Map country code to full name
            const countryData = heatmapData.data.find(item => item.country === d);
            return countryData ? countryData.country_name : d;
        })
        .style('font-size', '10px');
    
    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -30)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .text('Olympic Medal Distribution by Country and Sport');
    
    // Add subtitle with current selections
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .style('font-size', '12px')
        .text(`${medalTypeHeatmap.options[medalTypeHeatmap.selectedIndex].text} - ${yearRangeHeatmap.options[yearRangeHeatmap.selectedIndex].text} (${heatmapData.year_min || ''}-${heatmapData.year_max || ''})`);
    
    // Create color legend
    const legendWidth = 250;
    const legendHeight = 20;
    
    const legendX = width - legendWidth;
    const legendY = -50;
    
    // Create gradient for legend
    const defs = svg.append('defs');
    
    const gradient = defs.append('linearGradient')
        .attr('id', 'heatmap-gradient')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '100%')
        .attr('y2', '0%');
    
    gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', colorScale(0));
    
    gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', colorScale(heatmapData.max_value));
    
    // Draw legend rectangle
    svg.append('rect')
        .attr('x', legendX)
        .attr('y', legendY)
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', 'url(#heatmap-gradient)');
    
    // Add legend title
    svg.append('text')
        .attr('x', legendX)
        .attr('y', legendY - 5)
        .style('font-size', '10px')
        .text('Medal Count');
    
    // Add legend ticks
    const legendScale = d3.scaleLinear()
        .domain([0, heatmapData.max_value])
        .range([0, legendWidth]);
    
    const legendAxis = d3.axisBottom(legendScale)
        .ticks(5);
    
    svg.append('g')
        .attr('transform', `translate(${legendX},${legendY + legendHeight})`)
        .call(legendAxis)
        .selectAll('text')
        .style('font-size', '10px');
    
    // Draw cluster boundaries if clustering is enabled
    if (applyCluster) {
        // Get unique cluster IDs
        const countryClusters = [...new Set(heatmapData.data.map(d => d.country_cluster))];
        const sportClusters = [...new Set(heatmapData.data.map(d => d.sport_cluster))];
        
        // Map countries to clusters
        const countryClusterMap = {};
        heatmapData.data.forEach(d => {
            countryClusterMap[d.country] = d.country_cluster;
        });
        
        // Map sports to clusters
        const sportClusterMap = {};
        heatmapData.data.forEach(d => {
            sportClusterMap[d.sport] = d.sport_cluster;
        });
        
        // Draw horizontal lines between country clusters
        countries.forEach((country, i) => {
            if (i > 0) {
                const currentCluster = countryClusterMap[country];
                const prevCluster = countryClusterMap[countries[i-1]];
                
                if (currentCluster !== prevCluster) {
                    svg.append('line')
                        .attr('x1', 0)
                        .attr('y1', yScale(country))
                        .attr('x2', width)
                        .attr('y2', yScale(country))
                        .attr('stroke', '#000')
                        .attr('stroke-width', 2);
                }
            }
        });
        
        // Draw vertical lines between sport clusters
        sports.forEach((sport, i) => {
            if (i > 0) {
                const currentCluster = sportClusterMap[sport];
                const prevCluster = sportClusterMap[sports[i-1]];
                
                if (currentCluster !== prevCluster) {
                    svg.append('line')
                        .attr('x1', xScale(sport))
                        .attr('y1', 0)
                        .attr('x2', xScale(sport))
                        .attr('y2', height)
                        .attr('stroke', '#000')
                        .attr('stroke-width', 2);
                }
            }
        });
    }
}

// Load Sankey diagram data from API
function loadSankeyData() {
    // Show loading indicator
    document.getElementById('sankeyContainer').innerHTML = '<div class="d-flex justify-content-center align-items-center" style="height: 500px;"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
    
    // Get selected values from controls
    const medalType = medalTypeSankey.value;
    const flowTypeValue = flowType.value;
    const nodeLimit = nodeLimitSankey.value;
    
    // Log request parameters for debugging
    console.log('Loading Sankey data with parameters:', { medalType, flowTypeValue, nodeLimit });
    
    // Fetch data from API with proper parameter encoding
    const url = `/api/medal-flow?medal_type=${encodeURIComponent(medalType)}&flow_type=${encodeURIComponent(flowTypeValue)}&node_limit=${encodeURIComponent(nodeLimit)}`;
    console.log('Fetching from URL:', url);
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Received Sankey data:', data);
            // Check if data is properly formatted before processing
            if (!data || !data.nodes || !data.links || data.nodes.length === 0 || data.links.length === 0) {
                throw new Error('Invalid data format or empty dataset');
            }
            
            // Store data globally
            sankeyData = data;
            
            // Create visualization
            createSankeyDiagram();
        })
        .catch(error => {
            console.error('Error loading Sankey data:', error);
            document.getElementById('sankeyContainer').innerHTML = `<div class="alert alert-danger">Error loading data: ${error.message}. Please try different parameters.</div>`;
        });
}

// Create medal flow Sankey diagram
function createSankeyDiagram() {
    // Validate that sankeyData is available and properly formatted
    if (!sankeyData || !sankeyData.nodes || !sankeyData.links || sankeyData.nodes.length === 0 || sankeyData.links.length === 0) {
        console.error('Invalid Sankey data format or empty dataset');
        document.getElementById('sankeyContainer').innerHTML = '<div class="alert alert-warning">No data available for the selected parameters. Please try different selections.</div>';
        return;
    }
    
    // Check if d3.sankey is available
    if (typeof d3.sankey !== 'function') {
        console.error('D3 Sankey plugin not loaded');
        document.getElementById('sankeyContainer').innerHTML = '<div class="alert alert-danger">Required visualization library not loaded. Please check the console for more information.</div>';
        return;
    }
    
    // Clear container
    document.getElementById('sankeyContainer').innerHTML = '';
    
    // Set up dimensions
    const margin = {top: 20, right: 20, bottom: 20, left: 20};
    const width = 1000 - margin.left - margin.right;
    const height = 700 - margin.top - margin.bottom;
    
    // Create SVG container
    const svg = d3.select('#sankeyContainer')
        .append('svg')
        .attr('width', '100%')
        .attr('height', height + margin.top + margin.bottom)
        .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Set up color scale for nodes
    const nodeColorScale = d3.scaleOrdinal(d3.schemeCategory10);
    
    // Set up Sankey generator
    const sankey = d3.sankey()
        .nodeWidth(15)
        .nodePadding(10)
        .extent([[0, 0], [width, height]]);
    
    // Format data for Sankey layout
    const sankeyLayout = sankey({
        nodes: sankeyData.nodes,
        links: sankeyData.links
    });
    
    // Draw links
    const link = svg.append('g')
        .selectAll('.link')
        .data(sankeyLayout.links)
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('d', d3.sankeyLinkHorizontal())
        .attr('stroke-width', d => Math.max(1, d.width))
        .style('stroke', d => {
            // Gradient based on source and target nodes
            return '#ccc';
        })
        .style('fill', 'none')
        .style('stroke-opacity', 0.3)
        .on('mouseover', function(event, d) {
            // Highlight link
            d3.select(this)
                .style('stroke-opacity', 0.7);
            
            // Show tooltip
            const tooltip = d3.select('body')
                .append('div')
                .attr('class', 'tooltip')
                .style('opacity', 0)
                .style('position', 'absolute')
                .style('padding', '10px')
                .style('background', 'rgba(0, 0, 0, 0.8)')
                .style('color', 'white')
                .style('border-radius', '5px')
                .style('pointer-events', 'none');
            
            tooltip.transition()
                .duration(200)
                .style('opacity', 0.9);
            
            tooltip.html(`
                <strong>${d.source.name}</strong> → <strong>${d.target.name}</strong><br>
                Medals: ${d.value}
            `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function() {
            // Remove highlight
            d3.select(this)
                .style('stroke-opacity', 0.3);
            
            // Remove tooltip
            d3.selectAll('.tooltip').remove();
        });
    
    // Draw nodes
    const node = svg.append('g')
        .selectAll('.node')
        .data(sankeyLayout.nodes)
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', d => `translate(${d.x0},${d.y0})`);
    
    // Node colors by type
    const nodeColors = {
        'year': '#1f77b4',    // Blue for years
        'sport': '#2ca02c',   // Green for sports
        'country': '#d62728'  // Red for countries
    };
    
    // Add rectangles for nodes
    node.append('rect')
        .attr('height', d => d.y1 - d.y0)
        .attr('width', d => d.x1 - d.x0)
        .style('fill', d => d.color || nodeColors[d.type] || '#999')
        .style('stroke', '#000')
        .on('mouseover', function(event, d) {
            // Highlight related links
            link
                .style('stroke-opacity', l => {
                    return (l.source === d || l.target === d) ? 0.7 : 0.1;
                });
            
            // Show tooltip
            const tooltip = d3.select('body')
                .append('div')
                .attr('class', 'tooltip')
                .style('opacity', 0)
                .style('position', 'absolute')
                .style('padding', '10px')
                .style('background', 'rgba(0, 0, 0, 0.8)')
                .style('color', 'white')
                .style('border-radius', '5px')
                .style('pointer-events', 'none');
            
            tooltip.transition()
                .duration(200)
                .style('opacity', 0.9);
            
            // Calculate total incoming and outgoing
            const incoming = d.targetLinks.reduce((sum, link) => sum + link.value, 0);
            const outgoing = d.sourceLinks.reduce((sum, link) => sum + link.value, 0);
            
            tooltip.html(`
                <strong>${d.name}</strong><br>
                Total Medals: ${Math.max(incoming, outgoing)}<br>
                ${incoming > 0 ? `Incoming: ${incoming}<br>` : ''}
                ${outgoing > 0 ? `Outgoing: ${outgoing}` : ''}
            `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function() {
            // Reset link opacity
            link.style('stroke-opacity', 0.3);
            
            // Remove tooltip
            d3.selectAll('.tooltip').remove();
        })
        .call(d3.drag()
            .subject(d => d)
            .on('start', function() {
                this.parentNode.appendChild(this);
            })
            .on('drag', function(event, d) {
                d3.select(this.parentNode)
                    .attr('transform', `translate(${d.x0 = Math.max(0, Math.min(width - (d.x1 - d.x0), event.x))},${d.y0 = Math.max(0, Math.min(height - (d.y1 - d.y0), event.y))})`);
                
                // Update position for the node data
                d.x1 = d.x0 + (d.x1 - d.x0);
                d.y1 = d.y0 + (d.y1 - d.y0);
                
                // Update the links
                sankey.update(sankeyLayout);
                link.attr('d', d3.sankeyLinkHorizontal());
            }));
    
    // Add labels for nodes
    node.append('text')
        .attr('x', d => d.x0 < width / 2 ? (d.x1 - d.x0) + 6 : -6)
        .attr('y', d => (d.y1 - d.y0) / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
        .text(d => {
            // Shorten long names
            const name = d.name;
            return name.length > 20 ? name.substring(0, 18) + '...' : name;
        })
        .style('font-size', '10px')
        .style('font-weight', d => d.type === 'year' ? 'bold' : 'normal')
        .style('pointer-events', 'none');
    
    // Add legend
    const legend = svg.append('g')
        .attr('transform', `translate(${width - 150}, 10)`);
    
    // Legend items with correct colors
    const legendItems = [
        { label: 'Year', type: 'year', color: '#1f77b4' },
        { label: 'Sport', type: 'sport', color: '#ff7f0e' },
        { label: 'Country', type: 'country', color: '#2ca02c' }
    ];
    
    legend.selectAll('rect')
        .data(legendItems)
        .enter()
        .append('rect')
        .attr('x', 0)
        .attr('y', (d, i) => i * 20)
        .attr('width', 12)
        .attr('height', 12)
        .style('fill', d => d.color);
    
    legend.selectAll('text')
        .data(legendItems)
        .enter()
        .append('text')
        .attr('x', 20)
        .attr('y', (d, i) => i * 20 + 10)
        .text(d => d.label)
        .style('font-size', '12px');
    
    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -5)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .text(`Olympic Medal Flow - ${medalTypeSankey.options[medalTypeSankey.selectedIndex].text} (All Olympic Years)`);
}

// Update heatmap when clustering toggle changes
function updateHeatmap() {
    if (heatmapData) {
        createHeatmap();
    }
} 