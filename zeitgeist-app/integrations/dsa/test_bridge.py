import os
from datetime import datetime, timezone
import subprocess
import time
import unittest
from unittest.mock import patch

import pandas as pd
from fastapi.testclient import TestClient
from worker import completed_bars
from financials_worker import quarterly_records, statement_payload, BALANCE_ROWS, CASH_ROWS

# DSA_REPO_PATH must point to the checked-out fork for import-time validation.
os.environ['DSA_SERVICE_TOKEN'] = 'test-only-' + 'a' * 32
from bridge import app, cache, lock, financials_lock, forecast_lock


class BridgeTests(unittest.TestCase):
    def setUp(self):
        cache.clear()
        self.client = TestClient(app)
        self.headers = {'Authorization': 'Bearer ' + os.environ['DSA_SERVICE_TOKEN']}

    def test_auth_and_symbol_validation_do_not_start_worker(self):
        with patch('bridge.subprocess.run') as run:
            self.assertEqual(self.client.get('/v1/history/AAPL').status_code, 401)
            self.assertEqual(self.client.get('/v1/history/123', headers=self.headers).status_code, 400)
            run.assert_not_called()

    def test_upstream_timeout_is_bounded_and_not_cached(self):
        with patch('bridge.subprocess.run', side_effect=subprocess.TimeoutExpired('worker', 25)) as run:
            for _ in range(2):
                self.assertEqual(self.client.get('/v1/history/AAPL', headers=self.headers).status_code, 504)
            self.assertEqual(run.call_count, 2)
            self.assertEqual(run.call_args.kwargs['timeout'], 25)

    def test_warm_cache_remains_available_while_worker_is_busy(self):
        for kind, worker_lock, days in [('history', lock, 30), ('financials', financials_lock, 30), ('forecast', forecast_lock, 1100)]:
            cache[(kind, 'AAPL', days)] = (time.monotonic() + 60, {'cached': kind})
            worker_lock.acquire()
            try:
                with patch('bridge.subprocess.run') as run:
                    response = self.client.get(f'/v1/{kind}/AAPL', headers=self.headers)
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.json(), {'cached': kind})
                    run.assert_not_called()
                    self.assertEqual(self.client.get(f'/v1/{kind}/AAPL').status_code, 401)
            finally:
                worker_lock.release()

    def test_forecast_auth_timeout_and_cache(self):
        self.assertEqual(self.client.get('/v1/forecast/AAPL').status_code, 401)
        with patch('bridge.subprocess.run', side_effect=subprocess.TimeoutExpired('worker', 45)) as run:
            self.assertEqual(self.client.get('/v1/forecast/AAPL', headers=self.headers).status_code, 504)
            self.assertEqual(run.call_args.kwargs['timeout'], 45)
        result = subprocess.CompletedProcess([], 0, stdout='{"version":"test"}')
        with patch('bridge.subprocess.run', return_value=result) as run:
            for _ in range(2): self.assertEqual(self.client.get('/v1/forecast/AAPL', headers=self.headers).status_code, 200)
            self.assertEqual(run.call_count, 1)

    def test_early_close_holiday_and_unfinished_sessions(self):
        frame = pd.DataFrame([dict(date=day, open=100, high=102, low=99, close=101, volume=1000)
                              for day in ['2026-11-26', '2026-11-27', '2026-11-30']])
        # Thanksgiving is closed; Friday closes at 13:00 ET / 18:00 UTC.
        self.assertEqual(completed_bars(frame, datetime(2026, 11, 27, 18, 10, tzinfo=timezone.utc)), [])
        bars = completed_bars(frame, datetime(2026, 11, 27, 18, 30, tzinfo=timezone.utc))
        self.assertEqual(len(bars), 1)
        self.assertEqual(bars[0]['t'], int(datetime(2026, 11, 27, 18, tzinfo=timezone.utc).timestamp() * 1000))

    def test_financial_worker_retains_missing_loss_and_zero_without_ttm_fallback(self):
        frame = pd.DataFrame({pd.Timestamp('2026-06-30'): [100, -20, 0]}, index=['Total Revenue', 'Net Income', 'Operating Income'])
        result = quarterly_records(frame, datetime(2026, 10, 3, tzinfo=timezone.utc))
        self.assertEqual(result[0]['net_income'], -20)
        self.assertEqual(result[0]['operating_income'], 0)
        self.assertIsNone(result[0]['diluted_eps'])

    def test_financial_endpoint_requires_auth_and_uses_shorter_deadline(self):
        self.assertEqual(self.client.get('/v1/financials/AAPL').status_code, 401)
        with patch('bridge.subprocess.run', side_effect=subprocess.TimeoutExpired('worker', 10)) as run:
            self.assertEqual(self.client.get('/v1/financials/AAPL', headers=self.headers).status_code, 504)
            self.assertEqual(run.call_args.kwargs['timeout'], 10)

    def test_statement_failure_does_not_erase_other_tables(self):
        class Stock:
            quarterly_income_stmt = pd.DataFrame()
            quarterly_cashflow = pd.DataFrame({pd.Timestamp('2026-06-30'): [-20, -10, -30]}, index=['Operating Cash Flow', 'Capital Expenditure', 'Free Cash Flow'])
            @property
            def quarterly_balance_sheet(self):
                raise RuntimeError('upstream unavailable')
        result = statement_payload(Stock(), datetime(2026, 10, 3, tzinfo=timezone.utc))
        self.assertEqual(result['balance_sheet'], [])
        self.assertEqual(result['periods'], [])
        self.assertEqual(result['cash_flow'][0]['free_cash_flow'], -30)

    def test_balance_sheet_is_not_relabelled_to_match_income_date(self):
        frame = pd.DataFrame({pd.Timestamp('2026-03-31'): [100, 120, -20, 0]}, index=['Total Assets', 'Total Liabilities Net Minority Interest', 'Stockholders Equity', 'Cash And Cash Equivalents'])
        result = quarterly_records(frame, datetime(2026, 10, 3, tzinfo=timezone.utc), BALANCE_ROWS)
        self.assertEqual(result[0]['period_end'], '2026-03-31')
        self.assertEqual(result[0]['equity'], -20)
        self.assertEqual(result[0]['cash'], 0)
        self.assertIsNone(result[0]['total_debt'])


if __name__ == '__main__':
    unittest.main()
