"""Quarterly financial statements: never substitute TTM or annual figures."""
from datetime import datetime, timezone
import json
import math
import sys


INCOME_ROWS = [('revenue', 'Total Revenue'), ('net_income', 'Net Income'), ('operating_income', 'Operating Income'), ('diluted_eps', 'Diluted EPS')]
BALANCE_ROWS = [('total_assets', 'Total Assets'), ('total_liabilities', 'Total Liabilities Net Minority Interest'),
                ('equity', 'Stockholders Equity'), ('cash', 'Cash And Cash Equivalents'), ('total_debt', 'Total Debt')]
CASH_ROWS = [('operating_cash_flow', 'Operating Cash Flow'), ('capital_expenditure', 'Capital Expenditure'), ('free_cash_flow', 'Free Cash Flow')]


def quarterly_records(frame, now, fields=INCOME_ROWS):
    records = []
    if frame is None or frame.empty:
        return records
    for column in sorted(frame.columns, reverse=True):
        period = column.strftime('%Y-%m-%d')
        if period > now.date().isoformat():
            continue
        values = {}
        for field, row in fields:
            value = None
            if row in frame.index:
                try:
                    candidate = float(frame.loc[row, column])
                    if math.isfinite(candidate):
                        value = candidate
                except (TypeError, ValueError):
                    pass
            values[field] = value
        if any(value is not None for value in values.values()):
            records.append({'period_end': period, **values})
    return records[:6]


def statement_payload(stock, now):
    payload = {}
    for key, attribute, fields in [('periods', 'quarterly_income_stmt', INCOME_ROWS),
                                    ('balance_sheet', 'quarterly_balance_sheet', BALANCE_ROWS),
                                    ('cash_flow', 'quarterly_cashflow', CASH_ROWS)]:
        try:
            payload[key] = quarterly_records(getattr(stock, attribute), now, fields)
        except Exception:
            # A missing statement cannot erase the other successfully retrieved statements.
            payload[key] = []
    return payload


if __name__ == '__main__':
    import yfinance as yf
    # Same bridge command convention as the price worker; no code imports or credentials from callers.
    _, ticker, _ = sys.argv[1:]
    stock = yf.Ticker(ticker)
    info = stock.get_info()
    if info.get('symbol') != ticker:
        raise ValueError('Financial symbol mismatch')
    currency = info.get('financialCurrency')
    if not currency:
        raise ValueError('Statement currency unavailable')
    now = datetime.now(timezone.utc)
    payload = {'ticker': ticker, 'currency': currency, **statement_payload(stock, now)}
    print(json.dumps(payload, allow_nan=False))
