from datetime import datetime, timezone
import unittest
import numpy as np
from test_forecast import history
from sequence_models import NEURAL_MODELS, predict_sequence, training_arrays, sequence_rows
from stack_models import STACK_MODELS, predict_stack
from paper_strategies import STRATEGIES, positions_for, simulate_positions
from research_engine import evaluate_research, MODEL_IDS
from portfolio_research import evaluate_portfolio

NOW = datetime(2026, 10, 4, tzinfo=timezone.utc)


class ResearchTests(unittest.TestCase):
    def test_every_neural_architecture_is_finite_deterministic_and_future_invariant(self):
        bars = history(); changed = [dict(b) for b in bars]
        for b in changed[351:]:
            for k in ['o','h','l','c','v']: b[k] *= 7
        for model in NEURAL_MODELS:
            with self.subTest(model=model):
                before, cutoff = predict_sequence(bars,350,model)
                after, _ = predict_sequence(changed,350,model)
                np.testing.assert_array_equal(before,after)
                self.assertEqual(len(before),5); self.assertEqual(cutoff,350)
                self.assertTrue(np.all(np.isfinite(before)))

    def test_train_scaler_and_target_indices_do_not_use_query_or_future(self):
        bars = history(); changed=[dict(b) for b in bars]
        for b in changed[351:]: b['v']*=1e6
        before=training_arrays(bars,350);after=training_arrays(changed,350)
        for a,b in zip(before,after):np.testing.assert_array_equal(a,b)
        self.assertLessEqual(len(before[-1]),252)
        self.assertLessEqual(before[-1][-1]+5,350)
        self.assertEqual(sequence_rows(bars)[350].shape,(20,3))

    def test_classical_models_and_stack_do_not_use_future(self):
        bars=history();changed=[dict(b) for b in bars]
        for b in changed[351:]:
            for k in ['o','h','l','c','v']:b[k]*=7
        for model in STACK_MODELS:
            with self.subTest(model=model):
                a,_=predict_stack(bars,350,model);b,_=predict_stack(changed,350,model)
                np.testing.assert_array_equal(a,b)

    def test_paper_policies_are_frozen_and_signals_do_not_see_future(self):
        bars=history();changed=[dict(b) for b in bars]
        for b in changed[380:]:
            for k in ['o','h','l','c','v']:b[k]*=7
        start=len(bars)-151
        for name in STRATEGIES:
            with self.subTest(model=name):
                a=positions_for(bars,name,start);b=positions_for(changed,name,start)
                self.assertEqual(a[:380-start],b[:380-start])
                self.assertTrue(all(p in (0.,1.) for p in a))

    def test_costs_include_entry_exit_and_cash_does_not_earn_stock_returns(self):
        opens=np.full(5,100.)
        long=simulate_positions(opens,[1.,1.,1.,1.],0)
        self.assertAlmostEqual(long[-1]['equity'],.999**2)
        self.assertAlmostEqual(sum(r['turnover'] for r in long),2.)
        flat=simulate_positions(np.array([100.,110.,90.,120.,150.]),[0.]*4,0)
        self.assertTrue(all(r['equity']==1. for r in flat))

    def test_selected_prediction_keeps_gate_and_complete_windows(self):
        r=evaluate_research(history(),'AAPL','autoencoder',NOW)
        p=r['prediction'];self.assertEqual(len(p['windows']),30)
        self.assertEqual(p['windows'][-1]['target'],r['as_of'])
        self.assertEqual(p['qualified'],p['model']['mae_pp']<.95*min(p['flat']['mae_pp'],p['drift']['mae_pp']))
        self.assertEqual(p['forecast'] is not None,p['qualified'])

    def test_risk_and_strategy_payloads_never_publish_price_targets(self):
        for model in [*STRATEGIES,'risk_diagnostics']:
            r=evaluate_research(history(),'AAPL',model,NOW)
            self.assertIsNone(r['prediction'])
            if r['strategy']:
                self.assertEqual(len(r['strategy']['observations']),150)
                for o in r['strategy']['observations']:
                    self.assertLess(o['signal_date'],o['execution_date']);self.assertLess(o['execution_date'],o['date'])
            else:
                for point in r['risk']['scenarios']:self.assertLessEqual(point['p10'],point['p50']);self.assertLessEqual(point['p50'],point['p90'])

    def test_portfolio_weights_use_only_training_data(self):
        bars=history();other=[dict(b) for b in bars]
        for i,b in enumerate(other):
            scale=np.exp(np.sin(i/20)*.1)
            for k in ['o','h','l','c']:b[k]*=scale
        inputs={'AAPL':bars,'MSFT':other}
        before=evaluate_portfolio(inputs,NOW)
        mutated={t:[dict(b) for b in h] for t,h in inputs.items()}
        for b in mutated['MSFT'][-60:]:
            for k in ['o','h','l','c']:b[k]*=3
        after=evaluate_portfolio(mutated,NOW)
        self.assertEqual(before['weights'],after['weights'])
        self.assertEqual(len(before['optimized_equity']),60)
        self.assertAlmostEqual(sum(before['weights'].values()),1.)

    def test_unknown_module_rejected(self):
        with self.assertRaises(ValueError):evaluate_research(history(),'AAPL','__import__',NOW)
        self.assertEqual(len(MODEL_IDS),29)


if __name__=='__main__':unittest.main()
