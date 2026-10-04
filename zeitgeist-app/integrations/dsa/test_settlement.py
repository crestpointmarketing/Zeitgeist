from datetime import datetime, timezone
import unittest
import pandas as pd
from settlement_worker import settle


class SettlementTests(unittest.TestCase):
    def frame(self):
        return pd.DataFrame([dict(date=d,open=100,high=102,low=99,close=101,volume=1000) for d in
                             ['2026-11-19','2026-11-20','2026-11-23','2026-11-24','2026-11-25','2026-11-27']])

    def test_holiday_and_early_close_wait_for_complete_evidence(self):
        early=datetime(2026,11,27,18,19,tzinfo=timezone.utc)
        with self.assertRaises(ValueError):settle(self.frame(),'2026-11-19','2026-11-27',early)
        bars=settle(self.frame(),'2026-11-19','2026-11-27',datetime(2026,11,27,18,20,tzinfo=timezone.utc))
        self.assertEqual(len(bars),6)
        self.assertEqual(bars[-1]['t'],int(datetime(2026,11,27,18,tzinfo=timezone.utc).timestamp()*1000))

    def test_no_neighboring_session_substitution(self):
        now=datetime(2026,11,30,21,tzinfo=timezone.utc)
        with self.assertRaises(ValueError):settle(self.frame().iloc[:-1],'2026-11-19','2026-11-27',now)
        with self.assertRaises(ValueError):settle(self.frame(),'2026-11-20','2026-11-27',now)


if __name__=='__main__':unittest.main()
