// Global variables
let medalData = [];
let countryData = [];
let gamesData = [];
let sportData = {};
let isPlaying = false;
let animationTimer;
let currentChartData = null;

// Country colors - vibrant palette for better visualization
const countryColors = [
    "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", 
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
    "#ff5733", "#33ff57", "#5733ff", "#ff33a8", "#33fff8",
    "#c70039", "#900c3f", "#581845", "#ffc300", "#daf7a6"
];

// Sport Dominance Visualization
document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const sportSelect = document.getElementById('sportSelect');
    const yearSlider = document.getElementById('yearSlider');
    const yearDisplay = document.getElementById('yearDisplay');
    const animateBtn = document.getElementById('animateBtn');
    const resetBtn = document.getElementById('resetBtn');
    const medalBtns = document.querySelectorAll('.medal-type-btn');
    const countryLimit = document.getElementById('countryLimit');
    const dominanceChart = document.getElementById('dominanceChart');
    const countryLegend = document.getElementById('countryLegend');
    const currentSport = document.getElementById('currentSport');
    const timeInfo = document.getElementById('timeInfo');
    const loader = document.getElementById('loader');
    const viewModeToggle = document.getElementById('viewModeToggle');

    // Variables
    let allData = [];
    let currentMedalType = 'total';
    let currentYear = 1896;
    let isAnimating = false;
    let animationInterval;
    let svg;
    let isCumulativeView = true; // Default to cumulative view
    
    // Colors for countries (D3 color scheme)
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    
    // Initialize the visualization
    init();
    
    function init() {
        // Load sports list
        fetch('/api/sports')
            .then(response => response.json())
            .then(data => {
                populateSportsDropdown(data);
                // Load the first sport data
                if (data.length > 0) {
                    sportSelect.value = data[0];
                    loadSportData(data[0]);
                }
            })
            .catch(error => {
                console.error('Error loading sports:', error);
                dominanceChart.innerHTML = `<div class="alert alert-danger">Error loading sports data</div>`;
            });
            
        // Set up event listeners
        sportSelect.addEventListener('change', handleSportChange);
        yearSlider.addEventListener('input', handleYearChange);
        animateBtn.addEventListener('click', toggleAnimation);
        resetBtn.addEventListener('click', resetVisualization);
        countryLimit.addEventListener('change', updateVisualization);
        
        // Medal type buttons
        medalBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                medalBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                currentMedalType = this.getAttribute('data-medal');
        updateVisualization();
    });
});

        // View mode toggle (cumulative vs. single year)
        if (viewModeToggle) {
            viewModeToggle.addEventListener('change', function() {
                isCumulativeView = this.checked;
                updateVisualization();
            });
        }
        
        // Handle window resize
        window.addEventListener('resize', debounce(function() {
            if (allData.length > 0) {
                createVisualization();
        }
    }, 250));
}

    // Debounce function to prevent excessive resize calls
function debounce(func, wait) {
    let timeout;
    return function() {
        clearTimeout(timeout);
            timeout = setTimeout(func, wait);
        };
    }
    
    function populateSportsDropdown(sports) {
        sportSelect.innerHTML = '';
        sports.forEach(sport => {
            const option = document.createElement('option');
            option.value = sport;
            option.textContent = sport;
            sportSelect.appendChild(option);
        });
    }
    
    function handleSportChange() {
        stopAnimation();
        loadSportData(sportSelect.value);
    }
    
    function handleYearChange() {
        currentYear = parseInt(yearSlider.value);
        yearDisplay.textContent = currentYear;
        updateVisualization();
    }
    
    function loadSportData(sport) {
        // Show loader
        loader.style.display = 'flex';
        dominanceChart.style.display = 'none';
        
        // Update current sport display
        currentSport.textContent = sport;
        
        fetch(`/api/sport_medals?sport=${encodeURIComponent(sport)}`)
            .then(response => response.json())
            .then(data => {
                allData = data;
                createVisualization();
                loader.style.display = 'none';
                dominanceChart.style.display = 'block';
            })
            .catch(error => {
                console.error('Error loading sport data:', error);
                loader.style.display = 'none';
                dominanceChart.innerHTML = `<div class="alert alert-danger">Error loading data for ${sport}</div>`;
            });
    }
    
    function createVisualization() {
    // Clear previous chart
        dominanceChart.innerHTML = '';
        
        // Create SVG container with fixed size to avoid resizing issues
        const margin = {top: 30, right: 50, bottom: 70, left: 150};
        const width = 800 - margin.left - margin.right;
        const height = 500 - margin.top - margin.bottom;
        
        svg = d3.select('#dominanceChart')
        .append('svg')
            .attr('width', '100%')
        .attr('height', height + margin.top + margin.bottom)
            .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
        // Update visualization with current data
        updateVisualization();
    }
    
    function updateVisualization() {
        if (!svg || allData.length === 0) return;
        
        // Define chart dimensions
        const width = 620; // Fixed width
        const height = 400; // Fixed height
        
        // Filter data based on view mode and current year
        let yearData;
        if (isCumulativeView) {
            // Cumulative view - all medals up to current year
            yearData = allData.filter(d => d.year <= currentYear);
        } else {
            // Single year view - only medals from the current year
            yearData = allData.filter(d => d.year === currentYear);
        }
        
        // Group by country and get medal counts
        const countryData = d3.rollup(
            yearData,
            v => ({
                gold: d3.sum(v, d => d.gold),
                silver: d3.sum(v, d => d.silver),
                bronze: d3.sum(v, d => d.bronze),
                total: d3.sum(v, d => d.gold + d.silver + d.bronze)
            }),
            d => d.country
        );
        
        // Convert to array for sorting
        let sortedData = Array.from(countryData, ([country, medals]) => ({
            country,
            medals: medals[currentMedalType]
        }))
        .filter(d => d.medals > 0)
        .sort((a, b) => b.medals - a.medals);
        
        // Limit number of countries shown
        const limit = parseInt(countryLimit.value);
        sortedData = sortedData.slice(0, limit);
        
        // Check if we have data to display
        if (sortedData.length === 0) {
            svg.selectAll('*').remove();
            
            const message = `No medal data available for ${sportSelect.value} in ${currentYear}`;
            
            svg.append('text')
                .attr('x', width / 2)
                .attr('y', height / 2)
                .attr('text-anchor', 'middle')
                .style('font-size', '16px')
                .text(message);
            
            // Update info text
            if (isCumulativeView) {
                timeInfo.textContent = `Up to ${currentYear}`;
            } else {
                timeInfo.textContent = `Year ${currentYear}`;
            }
            
            countryLegend.innerHTML = '';
            return;
        }
        
        // Find max medal count for the scale
        const maxMedals = d3.max(sortedData, d => d.medals);
        
        // Create scales
        const xScale = d3.scaleLinear()
            .domain([0, maxMedals * 1.1]) // Add 10% padding
            .range([0, width])
            .nice();
            
        const yScale = d3.scaleBand()
            .domain(sortedData.map(d => d.country))
            .range([0, height])
            .padding(0.2);
            
        // Clear previous elements
        svg.selectAll('*').remove();
        
        // Add axes
        svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).ticks(5));
            
        svg.append('g')
            .attr('class', 'y-axis')
            .call(d3.axisLeft(yScale));
            
        // Add title
        const viewModeText = isCumulativeView ? "Cumulative" : "Year";
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
            .style('font-size', '14px')
        .style('font-weight', 'bold')
            .text(`${currentMedalType.charAt(0).toUpperCase() + currentMedalType.slice(1)} Medals in ${sportSelect.value} (${viewModeText})`);
            
        // Create a tooltip
    const tooltip = d3.select('body')
            .selectAll('.tooltip')
            .data([null])
            .join('div')
        .attr('class', 'tooltip')
            .style('opacity', 0);
        
        // Add bars
        svg.selectAll('.bar')
            .data(sortedData)
        .enter()
        .append('rect')
            .attr('class', 'bar')
            .attr('y', d => yScale(d.country))
            .attr('height', yScale.bandwidth())
        .attr('x', 0)
            .attr('width', d => Math.max(0, xScale(d.medals))) // Ensure width is always positive
            .attr('fill', d => colorScale(d.country))
            .attr('rx', 4)
            .attr('ry', 4)
        .on('mouseover', function(event, d) {
                d3.select(this).attr('opacity', 0.8);
            
            tooltip.transition()
                .duration(200)
                .style('opacity', 0.9);
            
                const viewType = isCumulativeView ? "Total up to" : "In";
            
            tooltip.html(`
                    <strong>${d.country}</strong><br>
                    ${currentMedalType === 'total' ? 'Total' : currentMedalType.charAt(0).toUpperCase() + currentMedalType.slice(1)} Medals ${viewType} ${currentYear}: ${d.medals}
            `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function() {
                d3.select(this).attr('opacity', 1);
            
            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
        });
    
        // Add labels
        svg.selectAll('.label')
            .data(sortedData)
        .enter()
        .append('text')
            .attr('class', 'label')
            .attr('y', d => yScale(d.country) + yScale.bandwidth() / 2)
            .attr('x', d => xScale(d.medals) + 5)
        .attr('dy', '.35em')
            .text(d => d.medals)
            .style('font-size', '12px');
            
        // Update legend
        updateCountryLegend(sortedData);
        
        // Update info text
        if (isCumulativeView) {
            timeInfo.textContent = `Up to ${currentYear}`;
        } else {
            timeInfo.textContent = `Year ${currentYear}`;
        }
    }
    
    function updateCountryLegend(data) {
        countryLegend.innerHTML = '';
        
        data.slice(0, 5).forEach((d, i) => {
            const legendItem = document.createElement('div');
            legendItem.className = i === 0 ? 'country-item top-country' : 'country-item';
            legendItem.style.marginRight = '8px';
            legendItem.innerHTML = `${d.country}: <strong>${d.medals}</strong>`;
            countryLegend.appendChild(legendItem);
        });
    }
    
function toggleAnimation() {
        if (isAnimating) {
        stopAnimation();
    } else {
        startAnimation();
    }
}

function startAnimation() {
        isAnimating = true;
        animateBtn.innerHTML = '<i class="bi bi-pause-fill me-1"></i>Pause';
        animateBtn.classList.remove('btn-success');
        animateBtn.classList.add('btn-warning');
        
        // Reset to start year if at end
        if (currentYear >= 2020) {
            currentYear = 1896;
            yearSlider.value = currentYear;
        }
        
        animationInterval = setInterval(() => {
            if (currentYear < 2020) {
                currentYear += 4;
                yearSlider.value = currentYear;
                yearDisplay.textContent = currentYear;
                updateVisualization();
            } else {
        stopAnimation();
            }
        }, 1000);
    }
    
    function stopAnimation() {
        if (!isAnimating) return;
        
        isAnimating = false;
        animateBtn.innerHTML = '<i class="bi bi-play-fill me-1"></i>Play Animation';
        animateBtn.classList.remove('btn-warning');
        animateBtn.classList.add('btn-success');
        
        clearInterval(animationInterval);
    }
    
    function resetVisualization() {
        stopAnimation();
        
        // Reset to starting year
        currentYear = 1896;
        yearSlider.value = currentYear;
        yearDisplay.textContent = currentYear;
        
        // Reset medal type
        medalBtns.forEach(btn => btn.classList.remove('active'));
        document.querySelector('[data-medal="total"]').classList.add('active');
        currentMedalType = 'total';
        
        // Reset view mode if toggle exists
        if (viewModeToggle) {
            viewModeToggle.checked = true;
            isCumulativeView = true;
        }
        
        updateVisualization();
    }
}); 