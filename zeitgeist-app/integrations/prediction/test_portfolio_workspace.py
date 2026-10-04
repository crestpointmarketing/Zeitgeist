from datetime import datetime, timezone
import unittest
import numpy as np
from test_forecast import history
from portfolio_research import evaluate_portfolio, allocation_curve

class PortfolioWorkspaceTests(unittest.TestCase):
    def test_custom_weights_are_validated_and_return_full_test_curve(self):
        bars=history(); h={'AAPL':bars,'MSFT':bars}
        p=evaluate_portfolio(h,datetime(2026,10,4,tzinfo=timezone.utc),{'AAPL':.4,'MSFT':.6})
        self.assertEqual(p['version'],'portfolio-research-v2')
        self.assertEqual(len(p['requested_equity']),60)
        self.assertLess(p['training_through'],p['test_start'])
        for w in [{'AAPL':1.1,'MSFT':-.1},{'AAPL':.5},{'AAPL':.8,'MSFT':.8}]:
            with self.assertRaises(ValueError):evaluate_portfolio(h,datetime(2026,10,4,tzinfo=timezone.utc),w)

    def test_test_period_changes_cannot_alter_fitted_weights(self):
        a=history();b=[dict(x) for x in a]
        for i,row in enumerate(b):
            for k in ['o','h','l','c']:row[k]*=1+i*.0003
        h={'AAPL':a,'MSFT':b};now=datetime(2026,10,4,tzinfo=timezone.utc)
        before=evaluate_portfolio(h,now,{'AAPL':.5,'MSFT':.5})
        changed=[dict(x) for x in b]
        for i,row in enumerate(changed[-60:]):
            for k in ['o','h','l','c']:row[k]*=1+i*.001
        after=evaluate_portfolio({'AAPL':a,'MSFT':changed},now,{'AAPL':.5,'MSFT':.5})
        self.assertEqual(before['weights'],after['weights'])
        self.assertEqual(before['train_correlation'],after['train_correlation'])
        self.assertNotEqual(before['requested_equity'],after['requested_equity'])

    def test_costs_include_both_entry_and_final_liquidation(self):
        p=allocation_curve(np.zeros((2,2)),np.array([.5,.5]))
        self.assertAlmostEqual(p[-1],.999*.999)

if __name__=='__main__':unittest.main()
