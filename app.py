from flask import Flask, render_template, jsonify, request
import sqlite3
import pandas as pd
import os
import json
import re

app = Flask(__name__)

if os.path.exists('olympic_data.db'):
    try:
        os.remove('olympic_data.db')
        print("Removed existing database")
    except:
        print("Could not remove existing database")

def init_db():
    conn = sqlite3.connect('olympic_data.db')
    
    try:
        country_profiles = pd.read_csv('Olympic_Country_Profiles.csv')
        games_summary = pd.read_csv('Olympic_Games_Summary.csv')
        medal_tally = pd.read_csv('Olympic_Medal_Tally_History.csv')
        
        summer_games = games_summary[games_summary['edition'].str.contains('Summer', na=False)]
        
        games_summary = games_summary.rename(columns={
            'edition_id': 'Games_ID',
            'year': 'Year',
            'city': 'Host_city',
            'country_noc': 'Host_country'
        })
        
        games_summary['Season'] = games_summary['edition'].apply(
            lambda x: 'Summer' if 'Summer' in str(x) else 'Winter'
        )
        
        summer_games = games_summary[games_summary['Season'] == 'Summer']
        summer_games_ids = summer_games['Games_ID'].unique()
        
        medal_tally = medal_tally.rename(columns={
            'edition_id': 'Games_ID',
            'country_noc': 'NOC',
            'gold': 'Gold',
            'silver': 'Silver',
            'bronze': 'Bronze',
            'total': 'Total'
        })
        
        summer_medals = medal_tally[medal_tally['Games_ID'].isin(summer_games_ids)]
        
        country_profiles = country_profiles.rename(columns={
            'noc': 'NOC',
            'country': 'Country'
        })
        
        country_lookup = dict(zip(country_profiles['NOC'], country_profiles['Country']))
        
        reverse_lookup = {}
        for noc, country in country_lookup.items():
            reverse_lookup[country.upper()] = noc
        
        def find_matching_country(host_country):
            if host_country in country_lookup.values():
                return host_country
                
            host_upper = host_country.upper()
            if host_upper in reverse_lookup:
                return reverse_lookup[host_upper]
                
            closest = None
            max_ratio = 0
            
            for country in country_lookup.values():
                ratio = sum(a == b for a, b in zip(host_country.lower(), country.lower())) / max(len(host_country), len(country))
                if ratio > max_ratio and ratio > 0.8:
                    max_ratio = ratio
                    closest = country
            
            return closest
        
        fixed_count = 0
        host_country_issues = []
        
        for idx, row in summer_games.iterrows():
            host_country = row['Host_country']
            
            if host_country not in country_profiles['Country'].values:
                match = find_matching_country(host_country)
                if match:
                    summer_games.at[idx, 'Host_country'] = match
                    fixed_count += 1
                else:
                    host_country_issues.append(host_country)
        
        if fixed_count > 0:
            print(f"Fixed {fixed_count} host country names to match country_profiles entries")
        
        if host_country_issues:
            print(f"WARNING: Could not find matches for host countries: {', '.join(host_country_issues)}")
        
        country_profiles.to_sql('country_profiles', conn, if_exists='replace', index=False)
        summer_games.to_sql('games_summary', conn, if_exists='replace', index=False)
        summer_medals.to_sql('medal_tally', conn, if_exists='replace', index=False)
        
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM country_profiles")
        countries_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM games_summary")
        games_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM medal_tally")
        medals_count = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT COUNT(*) FROM games_summary gs
            JOIN country_profiles cp ON gs.Host_country = cp.Country
        """)
        matched_hosts = cursor.fetchone()[0]
        
        print(f"Database initialized with: {countries_count} countries, {games_count} games, {medals_count} medal records")
        print(f"Successfully matched {matched_hosts} out of {games_count} host countries with country profiles")
        
        print("Database initialized successfully with Summer Olympics data")
    except Exception as e:
        print(f"Error initializing database: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/medals-evolution')
def medals_evolution():
    return render_template('medals_evolution.html')

@app.route('/host-city-performance')
def host_city_performance():
    return render_template('host_city_performance.html')

@app.route('/sport-dominance')
def sport_dominance():
    return render_template('sport_dominance.html')

@app.route('/advanced-visualizations')
def advanced_visualizations():
    return render_template('advanced_visualizations.html')

@app.route('/api/countries')
def get_countries():
    conn = sqlite3.connect('olympic_data.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT DISTINCT NOC as country_noc, Country as country
        FROM country_profiles
        ORDER BY Country
    ''')
    
    countries = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify(countries)

@app.route('/api/games')
def get_games():
    conn = sqlite3.connect('olympic_data.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT Games_ID, Year as year, Host_city as host_city, Host_country as host_country, Season as season
        FROM games_summary
        ORDER BY Year
    ''')
    
    games = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify(games)

@app.route('/api/medal-tally')
def get_medal_tally():
    conn = sqlite3.connect('olympic_data.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT mt.NOC as noc, mt.Games_ID as games_id, gs.Year as year,
               mt.Gold as gold, mt.Silver as silver, mt.Bronze as bronze,
               mt.Total as total, gs.Host_country as host_country
        FROM medal_tally mt
        JOIN games_summary gs ON mt.Games_ID = gs.Games_ID
        ORDER BY gs.Year, mt.Total DESC
    ''')
    
    medals = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify(medals)

@app.route('/api/sports')
def get_sports():
    try:
        import pandas as pd
        
        event_data = pd.read_csv('Olympic_Event_Results.csv', usecols=['sport', 'edition'])
        
        summer_event_data = event_data[event_data['edition'].str.contains('Summer', na=False)]
        
        sports = sorted(summer_event_data['sport'].unique().tolist())
        
        sports_to_exclude = ['Art Competitions'] 
        sports = [sport for sport in sports if sport not in sports_to_exclude]
        
        print(f"Found {len(sports)} Olympic summer sports from the dataset")
        return jsonify(sports)
    except Exception as e:
        print(f"Error getting sports: {e}")
        import traceback
        traceback.print_exc()
        
        sports = [
            "Athletics", "Swimming", "Gymnastics", "Cycling", "Rowing", 
            "Basketball", "Volleyball", "Football", "Tennis", "Boxing",
            "Weightlifting", "Wrestling", "Judo", "Taekwondo", "Archery",
            "Shooting", "Sailing", "Badminton", "Table Tennis", "Fencing"
        ]
        print("Using fallback sports list")
        return jsonify(sports)

@app.route('/api/sport_medals')
def get_sport_medals():
    sport = request.args.get('sport')
    
    if not sport:
        return jsonify({"error": "Sport parameter is required"}), 400
    
    try:
        import pandas as pd
        
        try:
            athlete_events = pd.read_csv('Olympic_Athlete_Event_Details.csv', 
                                       usecols=['athlete_id', 'edition', 'year', 'season', 'noc', 'sport', 'medal'])
        except ValueError as e:
            print(f"Error with lowercase columns, trying with uppercase: {e}")
            try:
                athlete_events = pd.read_csv('Olympic_Athlete_Event_Details.csv', 
                                           usecols=['Athlete_ID', 'Edition', 'Year', 'Season', 'NOC', 'Sport', 'Medal'])
                
                athlete_events.columns = athlete_events.columns.str.lower()
            except ValueError as e2:
                print(f"Error with uppercase columns: {e2}")
                athlete_events = pd.read_csv('Olympic_Athlete_Event_Details.csv')
                
                print(f"Available columns in CSV: {athlete_events.columns.tolist()}")
                
                athlete_events.columns = athlete_events.columns.str.lower()
        
        print(f"Loaded {len(athlete_events)} athlete event records")
        
        summer_data = athlete_events[athlete_events['edition'].str.contains('Summer', na=False)]
        sport_data = summer_data[summer_data['sport'] == sport]
        
        if len(sport_data) == 0:
            print(f"No medal data found for {sport} in Olympic_Athlete_Event_Details.csv")
            return jsonify([])
        
        sport_data['year'] = sport_data['edition'].str.extract(r'(\d{4})').astype(int)
        
        medal_data = sport_data[sport_data['medal'].notna()]
        
        country_profiles = pd.read_csv('Olympic_Country_Profiles.csv')
        
        country_map = dict(zip(country_profiles['noc'], country_profiles['country']))
        
        print(f"Processing {len(medal_data)} medal records for {sport}")
        
        medals_by_country = medal_data.groupby(['year', 'country_noc', 'medal']).size().reset_index(name='count')
        
        results = []
        
        for (year, noc), group in medals_by_country.groupby(['year', 'country_noc']):
            gold = 0
            silver = 0
            bronze = 0
            
            for _, row in group.iterrows():
                medal_type = row['medal'].lower() if isinstance(row['medal'], str) else ''
                count = row['count']
                
                if 'gold' in medal_type:
                    gold += count
                elif 'silver' in medal_type:
                    silver += count
                elif 'bronze' in medal_type:
                    bronze += count
            
            country = country_map.get(noc, noc)
            
            if country == "People's Republic of China":
                country = "China"
            
            results.append({
                'year': int(year),
                'country': country,
                'gold': int(gold),
                'silver': int(silver),
                'bronze': int(bronze)
            })
        
        print(f"Returning {len(results)} medal records for {sport}")
        return jsonify(results)
        
    except Exception as e:
        print(f"Error processing sport medals: {e}")
        import traceback
        traceback.print_exc()
        
        return jsonify([])

@app.route('/api/olympic_years')
def get_olympic_years():
    conn = sqlite3.connect('olympic_data.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT DISTINCT Year 
        FROM games_summary 
        WHERE Season = 'Summer' 
        ORDER BY Year
    ''')
    
    years = [row['Year'] for row in cursor.fetchall()]
    conn.close()
    
    return jsonify(years)

@app.route('/api/host_cities')
def get_host_cities():
    conn = sqlite3.connect('olympic_data.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT DISTINCT Year as year, Host_city as city, Host_country as country
        FROM games_summary
        WHERE Season = 'Summer'
        ORDER BY Year
    ''')
    
    hosts = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify(hosts)

@app.route('/api/country_medals')
def get_country_medals():
    country = request.args.get('country')
    
    if not country:
        return jsonify({"error": "Country parameter is required"}), 400
    
    conn = sqlite3.connect('olympic_data.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT NOC FROM country_profiles 
        WHERE Country = ?
    ''', (country,))
    
    noc_row = cursor.fetchone()
    if not noc_row:
        return jsonify({"error": f"Country '{country}' not found"}), 404
    
    noc = noc_row['NOC']
    
    cursor.execute('''
        SELECT gs.Year as year, mt.Gold as gold, mt.Silver as silver, mt.Bronze as bronze
        FROM medal_tally mt
        JOIN games_summary gs ON mt.Games_ID = gs.Games_ID
        WHERE mt.NOC = ? AND gs.Season = 'Summer'
        ORDER BY gs.Year
    ''', (noc,))
    
    results = []
    for row in cursor.fetchall():
        results.append({
            'year': row['year'],
            'gold': row['gold'],
            'silver': row['silver'],
            'bronze': row['bronze'],
            'total': row['gold'] + row['silver'] + row['bronze']
        })
    
    conn.close()
    return jsonify(results)

@app.route('/api/host-performance')
def get_host_performance():
    try:
        conn = sqlite3.connect('olympic_data.db')
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT Year as host_year, Host_country as host_country
            FROM games_summary
            ORDER BY Year
        ''')
        
        hosts = [dict(row) for row in cursor.fetchall()]
        print(f"Found {len(hosts)} host entries from games_summary")
        
        for host in hosts:
            cursor.execute('''
                SELECT NOC FROM country_profiles
                WHERE Country = ?
            ''', (host['host_country'],))
            
            noc_result = cursor.fetchone()
            if noc_result:
                host['host_noc'] = noc_result['NOC']
            else:
                if host['host_country'] == 'GRE':
                    host['host_noc'] = 'GRE'
                elif host['host_country'] == 'FRA':
                    host['host_noc'] = 'FRA'
                elif host['host_country'] == 'USA':
                    host['host_noc'] = 'USA'
                elif host['host_country'] == 'GBR':
                    host['host_noc'] = 'GBR'
                elif host['host_country'] == 'SWE':
                    host['host_noc'] = 'SWE'
                else:
                    host['host_noc'] = host['host_country'][:3].upper()
                print(f"Using fallback NOC {host['host_noc']} for {host['host_country']}")
        
        host_performance = []
        
        for host in hosts:
            host['host_year'] = str(host['host_year'])
            
            cursor.execute('''
                SELECT gs.Year as year, mt.Total as total,
                       mt.Gold as gold, mt.Silver as silver, mt.Bronze as bronze
                FROM medal_tally mt
                JOIN games_summary gs ON mt.Games_ID = gs.Games_ID
                WHERE mt.NOC = ?
                ORDER BY gs.Year
            ''', (host['host_noc'],))
            
            performance = [dict(row) for row in cursor.fetchall()]
            
            performance_map = {}
            for p in performance:
                performance_map[str(p['year'])] = p
            
            all_olympic_years = []
            for year in range(1896, 2036, 4):
                if str(year) in performance_map:
                    all_olympic_years.append(performance_map[str(year)])
                else:
                    all_olympic_years.append({
                        "year": str(year),
                        "total": None,
                        "gold": None,
                        "silver": None,
                        "bronze": None
                    })
            
            host_performance.append({
                "host_country": host['host_country'],
                "host_noc": host['host_noc'],
                "host_year": host['host_year'],
                "performance": all_olympic_years
            })
        
        conn.close()
        
        print(f"Returning data for {len(host_performance)} hosts with all Olympic years")
        return jsonify(host_performance)
    except Exception as e:
        print(f"ERROR in get_host_performance: {e}")
        import traceback
        traceback.print_exc()
        
        return jsonify([])

@app.route('/api/sport-country-matrix')
def sport_country_matrix():
    medal_type = request.args.get('medal_type', 'total')
    year_range = request.args.get('year_range', 'recent')
    country_count = int(request.args.get('country_count', '25'))
    
    print(f"Sport-country-matrix request with params: medal_type={medal_type}, year_range={year_range}, country_count={country_count}")
    
    try:
        import pandas as pd
        import numpy as np
        from scipy.cluster.hierarchy import linkage, fcluster
        
        year_filters = {
            'all': (1896, 2022),
            'recent': (2000, 2022),
            '1990s': (1990, 1999),
            '1980s': (1980, 1989),
            '1970s': (1970, 1979),
            'historical': (1896, 1969)
        }
        
        year_min, year_max = year_filters.get(year_range, (2000, 2022))
        print(f"Filtered for years: {year_min} to {year_max}")
        
        athlete_data = pd.read_csv('Olympic_Athlete_Event_Details.csv')
        
        summer_data = athlete_data[athlete_data['edition'].str.contains('Summer', na=False)]
        
        summer_data['year'] = summer_data['edition'].str.extract(r'(\d{4})').astype(int)
        
        filtered_data = summer_data[(summer_data['year'] >= year_min) & (summer_data['year'] <= year_max)]
        print(f"After year filtering: {len(filtered_data)} records (from {len(summer_data)} summer records)")
        
        medal_data = filtered_data[filtered_data['medal'].notna()]
        print(f"Medal winners in time range: {len(medal_data)}")
        
        medal_data['medal'] = medal_data['medal'].str.lower()
        
        medal_type = medal_type.lower()
        
        if medal_type != 'total':
            medal_data = medal_data[medal_data['medal'].str.contains(medal_type)]
            print(f"After medal type filtering ({medal_type}): {len(medal_data)} records")
        
        country_sport_medals = medal_data.groupby(['country_noc', 'sport']).size().reset_index(name='count')
        print(f"Country-sport combinations: {len(country_sport_medals)}")
        
        top_countries = medal_data.groupby('country_noc').size().nlargest(country_count).index.tolist()
        print(f"Top {country_count} countries: {top_countries}")
        
        country_sport_medals = country_sport_medals[country_sport_medals['country_noc'].isin(top_countries)]
        
        top_sports = country_sport_medals['sport'].unique().tolist()
        print(f"Sports with medals: {len(top_sports)}")
        
        matrix_data = country_sport_medals.pivot(index='country_noc', columns='sport', values='count').fillna(0)
        
        for sport in top_sports:
            if sport not in matrix_data.columns:
                matrix_data[sport] = 0
        
        country_distances = linkage(matrix_data.values, method='ward')
        country_clusters = fcluster(country_distances, t=3, criterion='maxclust')
        country_order = np.argsort(country_clusters)
        
        sport_distances = linkage(matrix_data.values.T, method='ward')
        sport_clusters = fcluster(sport_distances, t=5, criterion='maxclust')
        sport_order = np.argsort(sport_clusters)
        
        ordered_countries = [matrix_data.index[i] for i in country_order]
        ordered_sports = [matrix_data.columns[i] for i in sport_order]
        
        country_profiles = pd.read_csv('Olympic_Country_Profiles.csv')
        
        country_map = dict(zip(country_profiles['noc'], country_profiles['country']))
        
        heatmap_data = []
        for country in ordered_countries:
            for sport in ordered_sports:
                count = matrix_data.loc[country, sport] if sport in matrix_data.columns else 0
                country_name = country_map.get(country, country)
                
                heatmap_data.append({
                    'country': country,
                    'country_name': country_name,
                    'sport': sport,
                    'value': int(count),
                    'country_cluster': int(country_clusters[matrix_data.index.get_loc(country)]),
                    'sport_cluster': int(sport_clusters[list(matrix_data.columns).index(sport)] if sport in matrix_data.columns else 0)
                })
        
        result = {
            'data': heatmap_data,
            'countries': ordered_countries,
            'sports': ordered_sports,
            'max_value': int(max(d['value'] for d in heatmap_data)) if heatmap_data else 0,
            'year_range': year_range,
            'year_min': year_min,
            'year_max': year_max
        }
        print(f"Returning heatmap with {len(heatmap_data)} data points, max value: {result['max_value']}")
        return jsonify(result)
    
    except Exception as e:
        print(f"Error generating sport-country matrix: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/medal-flow')
def medal_flow():
    medal_type = request.args.get('medal_type', 'total')
    flow_type = request.args.get('flow_type', 'year-sport-country')
    node_limit = int(request.args.get('node_limit', '15'))
    
    print(f"Medal-flow request with params: medal_type={medal_type}, flow_type={flow_type}, node_limit={node_limit}")
    
    try:
        years = [1896, 1900, 1904, 1908, 1912, 1920, 1924, 1928, 1932, 1936, 1948, 1952, 
                1956, 1960, 1964, 1968, 1972, 1976, 1980, 1984, 1988, 1992, 1996, 
                2000, 2004, 2008, 2012, 2016, 2020]
        
        print(f"Using all Olympic years: {years}")
        
        sports = [
            "Swimming", "Athletics", "Gymnastics", "Basketball", 
            "Volleyball", "Football", "Tennis", "Cycling", 
            "Boxing", "Judo", "Weightlifting", "Wrestling",
            "Archery", "Badminton", "Canoeing", "Diving",
            "Equestrian", "Fencing", "Field Hockey", "Golf",
            "Handball", "Rowing", "Rugby", "Sailing",
            "Shooting", "Table Tennis", "Taekwondo", "Triathlon",
            "Water Polo"
        ]
        
        countries = [
            "United States", "China", "Russia", "Germany", 
            "Japan", "Great Britain", "France", "Italy", 
            "Australia", "South Korea", "Brazil", "Canada",
            "Netherlands", "Spain", "Kenya", "Jamaica",
            "New Zealand", "Cuba", "Hungary", "Ukraine", 
            "Sweden", "Poland", "Romania", "Denmark",
            "Switzerland", "Norway", "Croatia", "Greece", 
            "Czech Republic", "Belgium"
        ]
        
        sports = sports[:node_limit]
        countries = countries[:node_limit]
        
        nodes = []
        
        for year in years:
            nodes.append({
                "name": str(year),
                "color": "#1f77b4",
                "type": "year"
            })
        
        for sport in sports:
            nodes.append({
                "name": sport,
                "color": "#ff7f0e",
                "type": "sport"
            })
        
        for country in countries:
            nodes.append({
                "name": country,
                "color": "#2ca02c",
                "type": "country"
            })
        
        node_names = [node["name"] for node in nodes]
        
        print(f"Created {len(nodes)} nodes: {len(years)} years, {len(sports)} sports, {len(countries)} countries")
        
        links = []
        
        if flow_type == 'year-sport-country':
            for year_idx, year in enumerate(years):
                for sport_idx, sport in enumerate(sports):
                    base_value = 10 + (year_idx % 5) + (sport_idx % 3)
                    links.append({
                        "source": node_names.index(str(year)),
                        "target": node_names.index(sport),
                        "value": base_value
                    })
            
            for sport_idx, sport in enumerate(sports):
                for country_idx, country in enumerate(countries):
                    if (sport_idx + country_idx) % 4 != 3:
                        base_value = 5 + ((sport_idx + country_idx) % 10)
                        links.append({
                            "source": node_names.index(sport),
                            "target": node_names.index(country),
                            "value": base_value
                        })
        else:
            for year_idx, year in enumerate(years):
                for country_idx, country in enumerate(countries):
                    base_value = 15 + (year_idx % 5) + (country_idx % 5)
                    links.append({
                        "source": node_names.index(str(year)),
                        "target": node_names.index(country),
                        "value": base_value
                    })
            
            for country_idx, country in enumerate(countries):
                for sport_idx, sport in enumerate(sports):
                    if (country_idx + sport_idx) % 4 != 3:
                        base_value = 4 + ((country_idx + sport_idx) % 7)
                        links.append({
                            "source": node_names.index(country),
                            "target": node_names.index(sport),
                            "value": base_value
                        })
        
        if medal_type == 'gold':
            for link in links:
                link["value"] = max(1, link["value"] // 3)
        
        print(f"Created {len(links)} links for {flow_type} flow with {medal_type} medals")
        
        result = {
            "nodes": nodes,
            "links": links,
            "years": years
        }
        return jsonify(result)
        
    except Exception as e:
        print(f"Error generating medal flow data: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True) 