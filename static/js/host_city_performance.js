let hostPerformanceData = [];
let countryData = [];
let gamesData = [];
let isPlaying = false;
let animationTimer;

const medalColors = {
    total: "#1a3a6e",
    gold: "#ffd700",
    silver: "#c0c0c0",
    bronze: "#cd7f32"
};

document.addEventListener('DOMContentLoaded', function() {
    Promise.all([
        fetch('/api/host-performance').then(response => {
            if (!response.ok) {
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        }),
        fetch('/api/countries').then(response => {
            if (!response.ok) {
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        }),
        fetch('/api/games').then(response => {
            if (!response.ok) {
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
    ]).then(([hostData, countries, games]) => {
        console.log(`Loaded data: ${hostData.length} hosts, ${countries.length} countries, ${games.length} games`);
        
        hostPerformanceData = hostData;
        countryData = countries;
        gamesData = games;
        
        if (hostData.length === 0) {
            showDataError("No host performance data available");
            return;
        }
        
        initializeYearSlider();
        
        createHostPerformanceChart();
        createMedalHistoryChart();
        
        setupEventListeners();
    }).catch(error => {
        console.error('Error loading data:', error);
        showDataError(error.message);
    });
});

function showDataError(message) {
    const errorElement = document.getElementById('dataErrorMessage');
    if (errorElement) {
        const errorContent = errorElement.querySelector('p:last-child');
        if (errorContent) {
            errorContent.textContent = message || "There was a problem loading host country data. Please try refreshing the page.";
        }
        errorElement.classList.remove('d-none');
    }
    
    const yearSlider = document.getElementById('yearSlider');
    if (yearSlider) yearSlider.disabled = true;
    
    const playButton = document.getElementById('playAnimationBtn');
    if (playButton) playButton.disabled = true;
    
    document.querySelectorAll('input[name="medalType"]').forEach(radio => {
        radio.disabled = true;
    });
    
    document.getElementById('currentHostCountry').textContent = 'Data unavailable';
}

function initializeYearSlider() {
    const slider = document.getElementById('yearSlider');
    
    if (!hostPerformanceData || hostPerformanceData.length === 0) {
        console.error('No host performance data available for initializing slider');
        document.getElementById('currentHostCountry').textContent = 'No data available';
        return;
    }
    
    hostPerformanceData.forEach(host => {
        host.host_year = parseInt(host.host_year);
    });
    
    const hostYears = hostPerformanceData.map(host => host.host_year).sort((a, b) => a - b);
    
    if (hostYears.length === 0) {
        console.error('No valid host years found in data');
        document.getElementById('currentHostCountry').textContent = 'No data available';
        return;
    }
    
    slider.min = hostYears[0];
    slider.max = hostYears[hostYears.length - 1];
    slider.value = hostYears[hostYears.length - 1];
    
    const datalist = document.createElement('datalist');
    datalist.id = 'hostYearTicks';
    
    hostYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        datalist.appendChild(option);
    });
    
    slider.parentNode.appendChild(datalist);
    slider.setAttribute('list', 'hostYearTicks');
    
    document.getElementById('hostYearLabel').textContent = slider.value;
}

function setupEventListeners() {
    document.getElementById('yearSlider').addEventListener('input', function(e) {
        const selectedYear = parseInt(e.target.value);
        const hostYears = hostPerformanceData.map(host => parseInt(host.host_year)).sort((a, b) => a - b);
        
        if (hostYears.length === 0) {
            console.error('No host years available in data');
            document.getElementById('currentHostCountry').textContent = 'No data available';
            return;
        }
        
        const closestYear = hostYears.reduce((prev, curr) => {
            return (Math.abs(curr - selectedYear) < Math.abs(prev - selectedYear) ? curr : prev);
        }, hostYears[0]);
        
        this.value = closestYear;
        document.getElementById('hostYearLabel').textContent = closestYear;
        
        updateCurrentHostCountry(closestYear);
        
        createHostPerformanceChart();
        createMedalHistoryChart();
    });
    
    const initialYear = parseInt(document.getElementById('yearSlider').value);
    const hostYears = hostPerformanceData.map(host => parseInt(host.host_year)).sort((a, b) => a - b);
    
    if (hostYears.length > 0) {
        const closestInitialYear = hostYears.reduce((prev, curr) => {
            return (Math.abs(curr - initialYear) < Math.abs(prev - initialYear) ? curr : prev);
        }, hostYears[0]);
        
        document.getElementById('yearSlider').value = closestInitialYear;
        document.getElementById('hostYearLabel').textContent = closestInitialYear;
        updateCurrentHostCountry(closestInitialYear);
    } else {
        document.getElementById('currentHostCountry').textContent = 'No data available';
    }
    
    document.querySelectorAll('input[name="medalType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            createHostPerformanceChart();
            createMedalHistoryChart();
        });
    });
    
    document.getElementById('playAnimationBtn').addEventListener('click', function() {
        toggleAnimation();
    });
}

function updateCurrentHostCountry(year) {
    if (!year || isNaN(year)) {
        document.getElementById('currentHostCountry').textContent = 'Invalid year';
        return;
    }
    
    if (!hostPerformanceData || hostPerformanceData.length === 0) {
        document.getElementById('currentHostCountry').textContent = 'No data available';
        return;
    }
    
    const hostData = hostPerformanceData.find(h => h.host_year === parseInt(year));
    if (hostData) {
        document.getElementById('currentHostCountry').textContent = hostData.host_country;
    } else {
        document.getElementById('currentHostCountry').textContent = 'No host found';
    }
}

function createHostPerformanceChart() {
    // Clear previous chart
    d3.select('#hostPerformanceChart').html('');
    
    // Get selected year
    const selectedYear = parseInt(document.getElementById('yearSlider').value);
    
    // Find host country for selected year
    const hostData = hostPerformanceData.find(h => h.host_year === selectedYear);
    if (!hostData) {
        console.error(`No host data found for year ${selectedYear}`);
        // Try to find closest year
        if (hostPerformanceData.length > 0) {
            const years = hostPerformanceData.map(h => h.host_year).sort((a, b) => a - b);
            const closestYear = years.reduce((prev, curr) => {
                return (Math.abs(curr - selectedYear) < Math.abs(prev - selectedYear) ? curr : prev);
            }, years[0]);
            
            console.log(`Using closest year: ${closestYear}`);
            const closestHostData = hostPerformanceData.find(h => h.host_year === closestYear);
            if (closestHostData) {
                // Update the slider and continue with this data
                document.getElementById('yearSlider').value = closestYear;
                document.getElementById('hostYearLabel').textContent = closestYear;
                updateCurrentHostCountry(closestYear);
                return createHostPerformanceChart(); // Recursive call with updated year
            }
        }
        
        // No data or closest year found
        d3.select('#hostPerformanceChart')
            .append('div')
            .attr('class', 'alert alert-warning')
            .html('<p><i class="bi bi-exclamation-triangle-fill"></i> No data available for this host year.</p>');
        return;
    }
    
    // Get selected medal type
    const medalType = document.querySelector('input[name="medalType"]:checked').value;
    
    // Extract performance data
    const performance = hostData.performance;
    const hostYear = parseInt(hostData.host_year);
    
    // Check if performance data exists
    if (!performance || performance.length === 0) {
        d3.select('#hostPerformanceChart')
            .append('div')
            .attr('class', 'alert alert-warning')
            .html(`<p><i class="bi bi-exclamation-triangle-fill"></i> No performance data available for ${hostData.host_country}.</p>`);
        return;
    }
    
    // Ensure all performance data has the required fields
    performance.forEach(p => {
        // Convert string year to number if needed
        p.year = parseInt(p.year);
        
        // Ensure medal counts are numbers or null
        if (p.gold !== null) p.gold = parseInt(p.gold) || 0;
        if (p.silver !== null) p.silver = parseInt(p.silver) || 0;
        if (p.bronze !== null) p.bronze = parseInt(p.bronze) || 0;
        if (p.total !== null) p.total = parseInt(p.total) || 0;
        
        // Calculate total if needed from individual medal counts
        if (p.total === null && p.gold !== null && p.silver !== null && p.bronze !== null) {
            p.total = p.gold + p.silver + p.bronze;
        }
    });
    
    // Dimensions
    const containerWidth = document.getElementById('hostPerformanceChart').clientWidth;
    const margin = {top: 50, right: 50, bottom: 70, left: 70};
    const width = containerWidth - margin.left - margin.right;
    const height = 450 - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select('#hostPerformanceChart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Add title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -30)
        .attr('text-anchor', 'middle')
        .style('font-size', '18px')
        .text(`${hostData.host_country} Olympic Performance`);
    
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .text(`Host Year: ${hostYear}`);
    
    // Set up scales
    const x = d3.scaleBand()
        .domain(performance.map(d => d.year))
        .range([0, width])
        .padding(0.2);
    
    // Calculate max value for y scale, ignoring null values
    const maxValue = d3.max(performance.filter(d => d[medalType] !== null), d => d[medalType]) || 0;
    
    const y = d3.scaleLinear()
        .domain([0, maxValue * 1.1])
        .nice()
        .range([height, 0]);
    
    // Add X axis
    svg.append('g')
        .attr('class', 'axis x-axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).tickValues(x.domain().filter((d, i) => i % 3 === 0)))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)');
    
    // Add X axis label
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height + 50)
        .style('text-anchor', 'middle')
        .text('Olympic Year');
    
    // Add Y axis
    svg.append('g')
        .attr('class', 'axis y-axis')
        .call(d3.axisLeft(y));
    
    // Add Y axis label
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -40)
        .style('text-anchor', 'middle')
        .text(`${medalType.charAt(0).toUpperCase() + medalType.slice(1)} Medals`);
    
    // Create a tooltip
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);
    
    // Add the bars for years with actual data
    svg.selectAll('.bar')
        .data(performance.filter(d => d[medalType] !== null))
        .enter()
        .append('rect')
        .attr('class', d => d.year === hostYear ? 'bar host-bar' : 'bar')
        .attr('x', d => x(d.year))
        .attr('width', x.bandwidth())
        .attr('y', d => y(d[medalType]))
        .attr('height', d => height - y(d[medalType]))
        .attr('fill', d => d.year === hostYear ? '#ff4500' : medalColors[medalType])
        .on('mouseover', function(event, d) {
            tooltip.transition()
                .duration(200)
                .style('opacity', .9);
            
            tooltip.html(`
                <h5>${hostData.host_country}</h5>
                <p><strong>Year:</strong> ${d.year}${d.year === hostYear ? ' (Host Year)' : ''}</p>
                <p><strong>${medalType.charAt(0).toUpperCase() + medalType.slice(1)} Medals:</strong> ${d[medalType]}</p>
            `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
            
            d3.select(this)
                .attr('opacity', 0.8);
        })
        .on('mouseout', function() {
            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
            
            d3.select(this)
                .attr('opacity', 1);
        });
    
    // Add placeholder bars for years with null data
    svg.selectAll('.placeholder-bar')
        .data(performance.filter(d => d[medalType] === null))
        .enter()
        .append('rect')
        .attr('class', 'placeholder-bar')
        .attr('x', d => x(d.year))
        .attr('width', x.bandwidth())
        .attr('y', height)  // Bottom of the chart
        .attr('height', 0)  // No height for null data
        .attr('fill', 'none')  // Transparent
        .attr('stroke', d => d.year === hostYear ? '#ff4500' : '#ddd')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2');
    
    // Add host year marker
    if (x(hostYear)) {  // Only add if we have a valid x position
        svg.append('line')
            .attr('x1', x(hostYear))
            .attr('x2', x(hostYear))
            .attr('y1', 0)
            .attr('y2', height)
            .attr('stroke', '#ff4500')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5');
        
        svg.append('text')
            .attr('x', x(hostYear) + x.bandwidth() / 2)
            .attr('y', -10)
            .attr('text-anchor', 'middle')
            .attr('fill', '#ff4500')
            .text('Host Year');
    }
    
    // Add average medal count before hosting (only for years with real data)
    const preHostYears = performance.filter(p => p.year < hostYear && p[medalType] !== null);
    const preHostAvg = preHostYears.length > 0 
        ? d3.mean(preHostYears, d => d[medalType]) 
        : 0;
    
    // Add average medal count after hosting (only for years with real data)
    const postHostYears = performance.filter(p => p.year > hostYear && p[medalType] !== null);
    const postHostAvg = postHostYears.length > 0 
        ? d3.mean(postHostYears, d => d[medalType]) 
        : 0;
    
    // Add average lines
    if (preHostYears.length > 0) {
        svg.append('line')
            .attr('x1', 0)
            .attr('x2', x(hostYear))
            .attr('y1', y(preHostAvg))
            .attr('y2', y(preHostAvg))
            .attr('stroke', '#888')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '3,3');
        
        svg.append('text')
            .attr('x', 10)
            .attr('y', y(preHostAvg) - 5)
            .attr('fill', '#888')
            .style('font-size', '10px')
            .text(`Pre-host Avg: ${preHostAvg.toFixed(1)}`);
    }
    
    if (postHostYears.length > 0) {
        svg.append('line')
            .attr('x1', x(hostYear) + x.bandwidth())
            .attr('x2', width)
            .attr('y1', y(postHostAvg))
            .attr('y2', y(postHostAvg))
            .attr('stroke', '#888')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '3,3');
        
        svg.append('text')
            .attr('x', width - 120)
            .attr('y', y(postHostAvg) - 5)
            .attr('fill', '#888')
            .style('font-size', '10px')
            .text(`Post-host Avg: ${postHostAvg.toFixed(1)}`);
    }
}

function createMedalHistoryChart() {
    // Clear previous chart
    d3.select('#medalHistoryChart').html('');
    
    // Get selected year
    const selectedYear = parseInt(document.getElementById('yearSlider').value);
    
    // Find host country for selected year
    const hostData = hostPerformanceData.find(h => h.host_year === selectedYear);
    if (!hostData) {
        console.error(`No host data found for year ${selectedYear} in medal history chart`);
        d3.select('#medalHistoryChart')
            .append('div')
            .attr('class', 'alert alert-warning')
            .html('<p><i class="bi bi-exclamation-triangle-fill"></i> No data available for this host year.</p>');
        return;
    }
    
    // Extract performance data
    const performance = hostData.performance;
    const hostYear = parseInt(hostData.host_year);
    
    // Check if performance data exists
    if (!performance || performance.length === 0) {
        d3.select('#medalHistoryChart')
            .append('div')
            .attr('class', 'alert alert-warning')
            .html(`<p><i class="bi bi-exclamation-triangle-fill"></i> No performance data available for ${hostData.host_country}.</p>`);
        return;
    }
    
    // Ensure all performance data has the required fields
    performance.forEach(p => {
        // Convert string year to number if needed
        p.year = parseInt(p.year);
        
        // Ensure medal counts are numbers or null
        if (p.gold !== null) p.gold = parseInt(p.gold) || 0;
        if (p.silver !== null) p.silver = parseInt(p.silver) || 0;
        if (p.bronze !== null) p.bronze = parseInt(p.bronze) || 0;
        if (p.total !== null) p.total = parseInt(p.total) || 0;
        
        // Calculate total if needed from individual medal counts
        if (p.total === null && p.gold !== null && p.silver !== null && p.bronze !== null) {
            p.total = p.gold + p.silver + p.bronze;
        }
    });
    
    // Dimensions
    const containerWidth = document.getElementById('medalHistoryChart').clientWidth;
    const margin = {top: 30, right: 30, bottom: 70, left: 60};
    const width = containerWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select('#medalHistoryChart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Set up scales
    const x = d3.scaleBand()
        .domain(performance.map(d => d.year))
        .range([0, width])
        .padding(0.1);
    
    // Calculate max value for y scale, filtering out null values
    let maxTotal = d3.max(performance.filter(d => d.gold !== null && d.silver !== null && d.bronze !== null), 
        d => (d.gold + d.silver + d.bronze)) || 0;
    
    const y = d3.scaleLinear()
        .domain([0, maxTotal])
        .nice()
        .range([height, 0]);
    
    // Add X axis
    svg.append('g')
        .attr('class', 'axis x-axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).tickValues(x.domain().filter((d, i) => i % 3 === 0)))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-45)');
    
    // Add Y axis
    svg.append('g')
        .attr('class', 'axis y-axis')
        .call(d3.axisLeft(y));
    
    // Create a tooltip
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);
    
    // Add stacked bars for medal types - only for years with actual data
    performance.filter(d => d.gold !== null && d.silver !== null && d.bronze !== null).forEach(d => {
        // Bronze
        svg.append('rect')
            .attr('class', 'medal-bar bronze-bar')
            .attr('x', x(d.year))
            .attr('y', y(d.gold + d.silver + d.bronze))
            .attr('width', x.bandwidth())
            .attr('height', height - y(d.bronze))
            .attr('fill', medalColors.bronze)
            .attr('stroke', d.year === hostYear ? '#ff4500' : 'none')
            .attr('stroke-width', d.year === hostYear ? 2 : 0)
            .on('mouseover', function(event) {
                tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);
                
                tooltip.html(`
                    <h5>${hostData.host_country}</h5>
                    <p><strong>Year:</strong> ${d.year}${d.year === hostYear ? ' (Host Year)' : ''}</p>
                    <p><strong>Gold:</strong> ${d.gold}</p>
                    <p><strong>Silver:</strong> ${d.silver}</p>
                    <p><strong>Bronze:</strong> ${d.bronze}</p>
                    <p><strong>Total:</strong> ${d.gold + d.silver + d.bronze}</p>
                `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function() {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });
        
        // Silver
        svg.append('rect')
            .attr('class', 'medal-bar silver-bar')
            .attr('x', x(d.year))
            .attr('y', y(d.gold + d.silver))
            .attr('width', x.bandwidth())
            .attr('height', height - y(d.silver))
            .attr('fill', medalColors.silver)
            .attr('stroke', d.year === hostYear ? '#ff4500' : 'none')
            .attr('stroke-width', d.year === hostYear ? 2 : 0)
            .on('mouseover', function(event) {
                tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);
                
                tooltip.html(`
                    <h5>${hostData.host_country}</h5>
                    <p><strong>Year:</strong> ${d.year}${d.year === hostYear ? ' (Host Year)' : ''}</p>
                    <p><strong>Gold:</strong> ${d.gold}</p>
                    <p><strong>Silver:</strong> ${d.silver}</p>
                    <p><strong>Bronze:</strong> ${d.bronze}</p>
                    <p><strong>Total:</strong> ${d.gold + d.silver + d.bronze}</p>
                `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function() {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });
        
        // Gold
        svg.append('rect')
            .attr('class', 'medal-bar gold-bar')
            .attr('x', x(d.year))
            .attr('y', y(d.gold))
            .attr('width', x.bandwidth())
            .attr('height', height - y(d.gold))
            .attr('fill', medalColors.gold)
            .attr('stroke', d.year === hostYear ? '#ff4500' : 'none')
            .attr('stroke-width', d.year === hostYear ? 2 : 0)
            .on('mouseover', function(event) {
                tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);
                
                tooltip.html(`
                    <h5>${hostData.host_country}</h5>
                    <p><strong>Year:</strong> ${d.year}${d.year === hostYear ? ' (Host Year)' : ''}</p>
                    <p><strong>Gold:</strong> ${d.gold}</p>
                    <p><strong>Silver:</strong> ${d.silver}</p>
                    <p><strong>Bronze:</strong> ${d.bronze}</p>
                    <p><strong>Total:</strong> ${d.gold + d.silver + d.bronze}</p>
                `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function() {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });
    });
    
    // Add placeholder markers for years with no data
    performance.filter(d => d.gold === null || d.silver === null || d.bronze === null).forEach(d => {
        svg.append('rect')
            .attr('class', 'empty-year-marker')
            .attr('x', x(d.year))
            .attr('y', height - 5)  // Just a small marker at the bottom
            .attr('width', x.bandwidth())
            .attr('height', 5)
            .attr('fill', '#eee')
            .attr('stroke', d.year === hostYear ? '#ff4500' : '#ddd')
            .attr('stroke-width', 1);
    });
    
    // Add legend
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width - 100}, 0)`);
    
    const legendData = [
        { type: 'gold', label: 'Gold' },
        { type: 'silver', label: 'Silver' },
        { type: 'bronze', label: 'Bronze' }
    ];
    
    legendData.forEach((d, i) => {
        legend.append('rect')
            .attr('x', 0)
            .attr('y', i * 20)
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', medalColors[d.type]);
        
        legend.append('text')
            .attr('x', 25)
            .attr('y', i * 20 + 12)
            .text(d.label)
            .style('font-size', '12px');
    });
    
    // Add empty year legend
    legend.append('rect')
        .attr('x', 0)
        .attr('y', 3 * 20)
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', '#eee')
        .attr('stroke', '#ddd')
        .attr('stroke-width', 1);
    
    legend.append('text')
        .attr('x', 25)
        .attr('y', 3 * 20 + 12)
        .text('No Data')
        .style('font-size', '12px');
    
    // Add host year marker
    if (x(hostYear)) {  // Only add if we have a valid x position
        svg.append('line')
            .attr('x1', x(hostYear) + x.bandwidth() / 2)
            .attr('x2', x(hostYear) + x.bandwidth() / 2)
            .attr('y1', 0)
            .attr('y2', height)
            .attr('stroke', '#ff4500')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5');
    }
}

function toggleAnimation() {
    if (isPlaying) {
        stopAnimation();
    } else {
        startAnimation();
    }
}

function startAnimation() {
    isPlaying = true;
    document.getElementById('playAnimationBtn').innerHTML = '<i class="bi bi-pause-fill"></i> Pause';
    
    // Check if we have data
    if (!hostPerformanceData || hostPerformanceData.length === 0) {
        console.error('No host performance data available for animation');
        document.getElementById('currentHostCountry').textContent = 'No data available';
        stopAnimation();
        return;
    }
    
    const slider = document.getElementById('yearSlider');
    const hostYears = hostPerformanceData.map(host => parseInt(host.host_year)).sort((a, b) => a - b);
    
    if (hostYears.length === 0) {
        console.error('No valid host years for animation');
        document.getElementById('currentHostCountry').textContent = 'No data available';
        stopAnimation();
        return;
    }
    
    let currentYearIndex = hostYears.indexOf(parseInt(slider.value));
    if (currentYearIndex === -1) currentYearIndex = 0;
    
    animationTimer = setInterval(() => {
        currentYearIndex = (currentYearIndex + 1) % hostYears.length;
        const year = hostYears[currentYearIndex];
        
        // Update slider and label
        slider.value = year;
        document.getElementById('hostYearLabel').textContent = year;
        
        // Update current host country display
        updateCurrentHostCountry(year);
        
        // Update charts
        createHostPerformanceChart();
        createMedalHistoryChart();
    }, 2000);
}

function stopAnimation() {
    isPlaying = false;
    document.getElementById('playAnimationBtn').innerHTML = '<i class="bi bi-play-fill"></i> Play Animation';
    clearInterval(animationTimer);
} 