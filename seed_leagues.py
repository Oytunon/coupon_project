
import requests

# User provided list
leagues_raw = """
Super Lig = 3013
Premier League. Player Statistics = 18290431
Premier League - Fouls and Shots on Goal = 38243
Premier League - Cards and Corners = 36951
Premier League Cup = 18957
Premier League = 538
Bundesliga = 541
Bundesliga - Cards and Corners = 18260269
La Liga - Fouls and Shots on Goal = 36941
La Liga - Cards and Corners-(Football-Spain) = 36940
La Liga-(Football-Spain) = 545
NBA = 756
Euroleague = 686
UEFA Champions League = 566
UEFA Champions League. Player Statistics = 18290799
UEFA Champions League - Throws In and Offsides = 18278228
UEFA Champions League - Fouls and Shots on Goal = 35958
UEFA Champions League - Cards and Corners = 35957
UEFA Champions League. Outright = 19204
UEFA Europa League = 1861
UEFA Europa League - Cards and Corners = 18260607
UEFA Conference League = 18278410
La Liga. Player Statistics = 18290430
Serie A - Cards and Corners-(Football-Italy) = 18260074
Serie A (Football-Italy) = 543
Serie A. Player Statistics (Football-Italy) = 18290433
Pro League (Football-Belgium) = 557
Eredivisie (Football-Netherlands) = 1957
Liga Portugal - Cards and Corners (Football-Portugal) = 18291746
Liga Portugal-(Football) = 560
"""

# Parse
league_list = []
for line in leagues_raw.strip().split("\n"):
    if "=" in line:
        name, lid = line.split("=")
        league_list.append({"id": int(lid.strip()), "name": name.strip()})

# We will just print the JSON to be used or we can execute it against the API if it's running.
# Or better, we can direct insert using shared db session if we run this as a script in env.

from shared.database import SessionLocal
from shared.models.league import League

db = SessionLocal()
try:
    count = 0
    for l in league_list:
        existing = db.query(League).filter(League.id == l['id']).first()
        if existing:
            existing.name = l['name']
            print(f"Updated {l['name']}")
        else:
            db.add(League(id=l['id'], name=l['name']))
            print(f"Added {l['name']}")
            count += 1
    db.commit()
    print(f"Successfully seeded {count} new leagues.")
except Exception as e:
    print(f"Error: {e}")
    db.rollback()
finally:
    db.close()
