let medalData = [];
let countryData = [];
let gamesData = [];
let selectedCountries = [];
let isPlaying = false;
let animationTimer;

const medalColors = {
    gold: "#ffd700",
    silver: "#c0c0c0",
    bronze: "#cd7f32"
};

const countryColors = d3.schemeCategory10;

document.addEventListener('DOMContentLoaded', function() {
    Promise.all([
        fetch('/api/medal-tally').then(response => response.json()),
        fetch('/api/countries').then(response => response.json()),
        fetch('/api/games').then(response => response.json())
    ]).then(([medals, countries, games]) => {
        medalData = medals;
        countryData = countries;
        gamesData = games;
        
        populateCountrySelector();
        
        selectedCountries = ['USA', 'CHN', 'GBR'];
        updateSelectedCountriesInUI();
        
        createMedalEvolutionChart();
        createMedalRankingChart();
        
        setupEventListeners();
    }).catch(error => console.error('Error loading data:', error));
});

function populateCountrySelector() {
    const selector = document.getElementById('countrySelector');
    
    countryData.sort((a, b) => a.country.localeCompare(b.country));
    
    countryData.forEach(country => {
        const option = document.createElement('option');
        option.value = country.country_noc;
        option.textContent = country.country;
        selector.appendChild(option);
    });
}

function updateSelectedCountriesInUI() {
    const selector = document.getElementById('countrySelector');
    const selectedList = document.getElementById('selectedCountriesList');
    
    Array.from(selector.options).forEach(option => {
        option.selected = false;
    });
    
    selectedList.innerHTML = '';
    
    selectedCountries.forEach(countryCode => {
        const country = countryData.find(c => c.country_noc === countryCode);
        if (!country) return;
        
        const countryTag = document.createElement('span');
        countryTag.className = 'country-tag';
        countryTag.innerHTML = `${country.country} <span class="remove-btn" data-country="${countryCode}">×</span>`;
        selectedList.appendChild(countryTag);
    });
    
    document.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const countryCode = this.getAttribute('data-country');
            const index = selectedCountries.indexOf(countryCode);
            if (index !== -1) {
                selectedCountries.splice(index, 1);
                updateSelectedCountriesInUI();
                createMedalEvolutionChart();
                createMedalRankingChart();
            }
        });
    });
}

function setupEventListeners() {
    document.getElementById('addCountry').addEventListener('click', function() {
        const selector = document.getElementById('countrySelector');
        const selectedOptions = Array.from(selector.selectedOptions);
        
        selectedOptions.forEach(option => {
            if (!selectedCountries.includes(option.value)) {
                selectedCountries.push(option.value);
            }
        });
        
        updateSelectedCountriesInUI();
        createMedalEvolutionChart();
        createMedalRankingChart();
    });
    
    document.getElementById('goldMedal').addEventListener('change', function() {
        createMedalEvolutionChart();
        createMedalRankingChart();
    });
    
    document.getElementById('silverMedal').addEventListener('change', function() {
        createMedalEvolutionChart();
        createMedalRankingChart();
    });
    
    document.getElementById('bronzeMedal').addEventListener('change', function() {
        createMedalEvolutionChart();
        createMedalRankingChart();
    });
    
    document.getElementById('yearSlider').addEventListener('input', function(e) {
        const year = parseInt(e.target.value);
        document.getElementById('yearLabel').textContent = year;
        createMedalRankingChart(year);
    });
    
    document.getElementById('playButton').addEventListener('click', function() {
        toggleAnimation();
    });
}

function createMedalEvolutionChart() {
    d3.select('#medalEvolutionChart').html('');
    
    const medalTypes = {
        gold: document.getElementById('goldMedal').checked,
        silver: document.getElementById('silverMedal').checked,
        bronze: document.getElementById('bronzeMedal').checked
    };
    
    if (selectedCountries.length === 0 || !Object.values(medalTypes).some(v => v)) {
        return;
    }
    
    const containerWidth = document.getElementById('medalEvolutionChart').clientWidth;
    const margin = {top: 30, right: 150, bottom: 60, left: 70};
    const width = containerWidth - margin.left - margin.right;
    const height = 450 - margin.top - margin.bottom;
    
    const svg = d3.select('#medalEvolutionChart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    const yearData = {};
    
    gamesData.forEach(game => {
        const year = game.year;
        yearData[year] = { year: parseInt(year) };
        
        selectedCountries.forEach(country => {
            const countryMedals = medalData.filter(m => m.noc === country && m.year === year);
            
            if (countryMedals.length > 0) {
                const medalCounts = {
                    gold: medalTypes.gold ? countryMedals[0].gold : 0,
                    silver: medalTypes.silver ? countryMedals[0].silver : 0,
                    bronze: medalTypes.bronze ? countryMedals[0].bronze : 0
                };
                
                yearData[year][country] = {
                    gold: medalCounts.gold,
                    silver: medalCounts.silver,
                    bronze: medalCounts.bronze,
                    total: medalCounts.gold + medalCounts.silver + medalCounts.bronze
                };
            } else {
                yearData[year][country] = {
                    gold: 0,
                    silver: 0,
                    bronze: 0,
                    total: 0
                };
            }
        });
    });
    
    const data = Object.values(yearData).sort((a, b) => a.year - b.year);
    
    const x = d3.scaleLinear()
        .domain([d3.min(data, d => d.year), d3.max(data, d => d.year)])
        .range([0, width]);
    
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => {
            let max = 0;
            selectedCountries.forEach(country => {
                if (d[country] && d[country].total > max) {
                    max = d[country].total;
                }
            });
            return max;
        })])
        .nice()
        .range([height, 0]);
    
    svg.append('g')
        .attr('class', 'axis x-axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(10).tickFormat(d => d));
    
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height + 40)
        .style('text-anchor', 'middle')
        .text('Olympic Year');
    
    svg.append('g')
        .attr('class', 'axis y-axis')
        .call(d3.axisLeft(y));
    
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left + 15)
        .attr('x', -height / 2)
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .text('Medal Count');
    
    selectedCountries.forEach((country, index) => {
        const countryName = countryData.find(c => c.country_noc === country)?.country || country;
        const color = countryColors[index % countryColors.length];
        
        const lineGenerator = d3.line()
            .x(d => x(d.year))
            .y(d => y(d[country] ? d[country].total : 0))
            .curve(d3.curveMonotoneX);
        
        svg.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-width', 3)
            .attr('d', lineGenerator);
        
        const dataPoints = data.filter(d => d[country] && d[country].total > 0);
        
        svg.selectAll(`.point-${country}`)
            .data(dataPoints)
            .enter()
            .append('circle')
            .attr('class', `point-${country}`)
            .attr('cx', d => x(d.year))
            .attr('cy', d => y(d[country].total))
            .attr('r', 5)
            .attr('fill', color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .on('mouseover', function(event, d) {
                showTooltip(event, d, country);
            })
            .on('mouseout', function() {
                hideTooltip();
            });
        
        const lastPoint = dataPoints[dataPoints.length - 1];
        if (lastPoint) {
            svg.append('text')
                .attr('x', x(lastPoint.year) + 10)
                .attr('y', y(lastPoint[country].total))
                .attr('fill', color)
                .attr('font-weight', 'bold')
                .text(countryName);
        }
    });
    
    const tooltip = d3.select('#medalEvolutionChart')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('background-color', 'rgba(255, 255, 255, 0.9)')
        .style('border', '1px solid #ccc')
        .style('border-radius', '5px')
        .style('padding', '10px')
        .style('pointer-events', 'none')
        .style('box-shadow', '0 4px 8px rgba(0, 0, 0, 0.1)');
    
    function showTooltip(event, d, country) {
        const countryName = countryData.find(c => c.country_noc === country)?.country || country;
        
        let tooltipContent = `
            <div style="text-align: center; font-weight: bold; margin-bottom: 5px;">
                ${countryName} - ${d.year}
            </div>
            <div style="display: flex; justify-content: space-between;">
        `;
        
        const medals = [];
        if (medalTypes.gold) medals.push(`<span style="color: ${medalColors.gold}">Gold: ${d[country].gold}</span>`);
        if (medalTypes.silver) medals.push(`<span style="color: ${medalColors.silver}">Silver: ${d[country].silver}</span>`);
        if (medalTypes.bronze) medals.push(`<span style="color: ${medalColors.bronze}">Bronze: ${d[country].bronze}</span>`);
        
        tooltipContent += medals.join(' | ');
        tooltipContent += `</div><div style="text-align: center; margin-top: 5px;">Total: ${d[country].total}</div>`;
        
        tooltip
            .html(tooltipContent)
            .style('opacity', 1)
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 28}px`);
    }
    
    function hideTooltip() {
        tooltip.style('opacity', 0);
    }
}

function createMedalRankingChart(year) {
    d3.select('#medalRankingChart').html('');
    
    if (!year) {
        year = parseInt(document.getElementById('yearSlider').value);
        document.getElementById('yearLabel').textContent = year;
    }
    
    const medalTypes = {
        gold: document.getElementById('goldMedal').checked,
        silver: document.getElementById('silverMedal').checked,
        bronze: document.getElementById('bronzeMedal').checked
    };
    
    if (!Object.values(medalTypes).some(v => v)) {
        return;
    }
    
    const yearMedals = medalData.filter(m => m.year === year);
    
    const countryMedals = {};
    
    yearMedals.forEach(medal => {
        const noc = medal.noc;
        
        if (!countryMedals[noc]) {
            countryMedals[noc] = {
                noc: noc,
                country: countryData.find(c => c.country_noc === noc)?.country || noc,
                gold: medalTypes.gold ? medal.gold : 0,
                silver: medalTypes.silver ? medal.silver : 0,
                bronze: medalTypes.bronze ? medal.bronze : 0,
                total: 0
            };
        }
        
        countryMedals[noc].total = 
            (medalTypes.gold ? medal.gold : 0) + 
            (medalTypes.silver ? medal.silver : 0) + 
            (medalTypes.bronze ? medal.bronze : 0);
    });
    
    const data = Object.values(countryMedals)
        .sort((a, b) => b.total - a.total)
        .slice(0, 15);
    
    const containerWidth = document.getElementById('medalRankingChart').clientWidth;
    const margin = {top: 30, right: 30, bottom: 100, left: 70};
    const width = containerWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    
    const svg = d3.select('#medalRankingChart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text(`Medal Count Ranking for ${year} Olympics`);
    
    const x = d3.scaleBand()
        .domain(data.map(d => d.noc))
        .range([0, width])
        .padding(0.2);
    
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.total)])
        .nice()
        .range([height, 0]);
    
    svg.append('g')
        .attr('class', 'axis x-axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em');
    
    svg.append('g')
        .attr('class', 'axis y-axis')
        .call(d3.axisLeft(y));
    
    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);
    
    const bars = svg.selectAll('.bar')
        .data(data)
        .enter();
    
    function calculateSegments(d) {
        const segments = [];
        let runningTotal = 0;
        
        if (medalTypes.gold && d.gold > 0) {
            segments.push({
                type: 'gold',
                start: runningTotal,
                end: runningTotal + d.gold,
                count: d.gold
            });
            runningTotal += d.gold;
        }
        
        if (medalTypes.silver && d.silver > 0) {
            segments.push({
                type: 'silver',
                start: runningTotal,
                end: runningTotal + d.silver,
                count: d.silver
            });
            runningTotal += d.silver;
        }
        
        if (medalTypes.bronze && d.bronze > 0) {
            segments.push({
                type: 'bronze',
                start: runningTotal,
                end: runningTotal + d.bronze,
                count: d.bronze
            });
        }
        
        return segments;
    }
    
    data.forEach(d => {
        const segments = calculateSegments(d);
        
        segments.forEach(segment => {
            svg.append('rect')
                .attr('class', 'medal-bar')
                .attr('x', x(d.noc))
                .attr('y', y(segment.end))
                .attr('width', x.bandwidth())
                .attr('height', y(segment.start) - y(segment.end))
                .attr('fill', medalColors[segment.type])
                .on('mouseover', function(event) {
                    tooltip.transition()
                        .duration(200)
                        .style('opacity', .9);
                    
                    tooltip.html(`
                        <h5>${d.country}</h5>
                        <p><strong>Year:</strong> ${year}</p>
                        <p><strong>${segment.type.charAt(0).toUpperCase() + segment.type.slice(1)}:</strong> ${segment.count}</p>
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
        
        svg.append('text')
            .attr('class', 'bar-label')
            .attr('x', x(d.noc) + x.bandwidth() / 2)
            .attr('y', height + 15)
            .attr('text-anchor', 'middle')
            .text(d.noc)
            .style('font-size', '10px');
    });
    
    const legendData = [];
    if (medalTypes.gold) legendData.push({ type: 'gold', label: 'Gold' });
    if (medalTypes.silver) legendData.push({ type: 'silver', label: 'Silver' });
    if (medalTypes.bronze) legendData.push({ type: 'bronze', label: 'Bronze' });
    
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width - 100}, ${height + 50})`);
    
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
    
    const hostCountry = gamesData.find(g => g.year === year)?.host_country;
    if (hostCountry) {
        const hostNOC = countryData.find(c => c.country === hostCountry)?.country_noc;
        if (hostNOC && data.some(d => d.noc === hostNOC)) {
            svg.selectAll('.bar')
                .filter(d => d.noc === hostNOC)
                .classed('host-highlight', true);
            
            svg.append('text')
                .attr('x', x(hostNOC) + x.bandwidth() / 2)
                .attr('y', y(data.find(d => d.noc === hostNOC).total) - 10)
                .attr('text-anchor', 'middle')
                .style('font-size', '10px')
                .style('fill', '#ff4500')
                .text('Host');
        }
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
    document.getElementById('playButton').innerHTML = '<i class="bi bi-pause-fill"></i> Pause';
    
    const slider = document.getElementById('yearSlider');
    const minYear = parseInt(slider.min);
    const maxYear = parseInt(slider.max);
    let currentYear = parseInt(slider.value);
    
    animationTimer = setInterval(() => {
        currentYear += 4;
        
        if (currentYear > maxYear) {
            currentYear = minYear;
        }
        
        slider.value = currentYear;
        document.getElementById('yearLabel').textContent = currentYear;
        createMedalRankingChart(currentYear);
    }, 1000);
}

function stopAnimation() {
    isPlaying = false;
    document.getElementById('playButton').innerHTML = '<i class="bi bi-play-fill"></i> Play Animation';
    clearInterval(animationTimer);
} 