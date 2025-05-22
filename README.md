# Olympic Data Visualization

This project provides interactive visualizations of Olympic Games data from 1896 to present day, focusing on Summer Olympics. The visualizations showcase medal counts across countries, the effect of hosting the Olympics on a country's performance, and the dominance of countries in specific sports over time.

## Features

### 1. Olympic Medal Evolution Over Time
- Interactive timeline showing how countries' medal counts have evolved across Olympic history
- Compare multiple countries side by side
- Filter by medal type (gold/silver/bronze)
- Animated visualization of changing rankings over time

### 2. Host City Performance Analysis
- Visualization of how host countries perform before, during, and after hosting the Olympics
- Clear visualization of the "host country effect"
- Interactive selection of host countries and medal types
- Stacked bar charts showing medal breakdown

### 3. Sport Dominance by Nation
- Interactive visualization showing which countries dominate specific sports over time
- Filter by sport and year range
- Animation of changing dominance patterns over Olympic history

## Technologies Used

- Backend: Flask with SQLite database
- Frontend: HTML, CSS, JavaScript
- Data Visualization: D3.js
- Styling: Bootstrap

## Getting Started

### Prerequisites
- Python 3.7+
- Web browser

### Installation

1. Clone the repository
2. Install required packages:
```
pip install -r requirements.txt
```
3. Run the application:
```
python app.py
```
4. Open a web browser and go to http://127.0.0.1:5000/

## Data Sources

The application uses the following Olympic datasets:
- Olympic_Country_Profiles.csv - Information about countries participating in the Olympics
- Olympic_Games_Summary.csv - Summary information about all Olympic Games
- Olympic_Medal_Tally_History.csv - Historical medal counts for countries across Olympics

## Project Structure

- `app.py` - Main Flask application
- `static/` - Static files (CSS, JavaScript, etc.)
  - `css/` - CSS stylesheets
  - `js/` - JavaScript files for visualizations
- `templates/` - HTML templates
- `olympic_data.db` - SQLite database containing Olympic data

## License

This project is created for educational purposes as part of a university assignment.