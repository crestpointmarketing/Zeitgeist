"""Private bounded portfolio calculation from server-collected histories."""
import json
import sys
from pathlib import Path
from datetime import datetime, timezone
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'prediction'))
from portfolio_research import evaluate_portfolio

if __name__=='__main__':
    payload=json.loads(sys.stdin.read(2_000_001))
    print(json.dumps(evaluate_portfolio(payload['histories'],datetime.now(timezone.utc),payload['weights']),allow_nan=False))
