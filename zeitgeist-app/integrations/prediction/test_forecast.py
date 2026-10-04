from datetime import datetime, timezone
import unittest
import numpy as np
import exchange_calendars as xcals
from forecast_engine import evaluate, features, training_data, predict_at, predict_candidates_at, validate_bars, metrics, market_features, predict_boosted_at
from fork_models import simulate


def history(flat=False):
    calendar = xcals.get_calendar('XNYS')
    sessions = calendar.sessions_in_range('2024-01-01', '2026-10-02')[-420:]
    closes = np.full(len(sessions), 100.) if flat else 100 * np.exp(np.cumsum(np.random.default_rng(7).normal(.0002, .01, len(sessions))))
    return [dict(o=float(c), h=float(c * 1.01), l=float(c * .99), c=float(c), v=1000,
                 t=int(calendar.session_close(day).timestamp() * 1000)) for day, c in zip(sessions, closes)]


class MeanModel:
    def fit(self, x, y): self.value = float(y.mean())
    def predict(self, x): return np.full(len(x), self.value)


class ForecastTests(unittest.TestCase):
    def test_labels_mature_before_origin_and_training_window_is_bounded(self):
        closes = np.exp(np.linspace(4, 5, 900))
        x, y, indices = training_data(closes, 850)
        self.assertEqual(len(x), 504)
        self.assertEqual(indices[-1] + 5, 850)
        self.assertEqual(len(y), len(x))

    def test_future_mutations_cannot_change_historical_prediction_or_features(self):
        closes = np.array([b['c'] for b in history()])
        changed = closes.copy(); changed[351:] *= 8
        np.testing.assert_array_equal(features(closes, 350), features(changed, 350))
        # Real fork-adapted estimators, not a mock model.
        before = predict_at(closes, 350)
        after = predict_at(changed, 350)
        self.assertEqual(before, after)
        self.assertLessEqual(before[1], 350)

    def test_walk_forward_windows_are_nonoverlapping_and_have_no_future_labels(self):
        report = evaluate(history(), 'AAPL', datetime(2026, 10, 3, tzinfo=timezone.utc), factory=lambda: [MeanModel(), MeanModel()])
        windows = report['backtest']['windows']
        self.assertEqual(len(windows), 30)
        self.assertEqual(windows[-1]['target'], report['as_of'])
        for i, window in enumerate(windows):
            self.assertLessEqual(window['training_labels_through'], window['origin'])
            self.assertLess(window['origin'], window['target'])
            if i: self.assertEqual(windows[i-1]['target'], window['origin'])
        self.assertGreater(report['target_date'], report['as_of'])

    def test_flat_history_cannot_be_promoted_and_is_not_directional_accuracy(self):
        report = evaluate(history(flat=True), 'AAPL', datetime(2026, 10, 3, tzinfo=timezone.utc), factory=lambda: [MeanModel(), MeanModel()])
        self.assertFalse(report['qualified'])
        self.assertIsNone(report['forecast'])
        self.assertIsNone(report['backtest']['direction_hit_pct'])
        self.assertEqual(report['backtest']['direction_samples'], 0)
        self.assertTrue(all(p['p10'] == p['p90'] for p in report['simulation']))

    def test_all_comparators_are_invariant_to_future_prices(self):
        closes = np.array([b['c'] for b in history()])
        changed = closes.copy(); changed[351:] *= 8
        self.assertEqual(predict_candidates_at(closes, 350), predict_candidates_at(changed, 350))

    def test_candidate_metrics_match_same_windows_and_do_not_select_a_new_primary(self):
        report = evaluate(history(), 'AAPL', datetime(2026, 10, 3, tzinfo=timezone.utc), factory=lambda: [MeanModel(), MeanModel()])
        self.assertEqual(report['version'], 'fork-comparison-v3')
        windows = report['backtest']['windows']
        actual = [w['actual_return_pct'] / 100 for w in windows]
        for key in ['extra_trees', 'random_forest', 'ridge', 'gradient_boosting']:
            expected = metrics([w['candidate_returns_pct'][key] / 100 for w in windows], actual)
            self.assertEqual(expected, report['backtest']['candidates'][key])
        backtest = report['backtest']
        self.assertEqual(report['qualified'], backtest['model']['mae_pp'] < .95 * min(backtest['flat']['mae_pp'], backtest['drift']['mae_pp']))
        boosted_pass = backtest['candidates']['gradient_boosting']['mae_pp'] < .95 * min(backtest['flat']['mae_pp'], backtest['drift']['mae_pp'])
        self.assertEqual(report['boosted_forecast'] is not None, boosted_pass)

    def test_boosted_model_and_price_volume_features_cannot_see_future_rows(self):
        bars = history()
        changed = [dict(b) for b in bars]
        for bar in changed[351:]:
            for key in ['o', 'h', 'l', 'c', 'v']: bar[key] *= 8
        np.testing.assert_array_equal(market_features(bars, 350), market_features(changed, 350))
        self.assertEqual(predict_boosted_at(bars, 350), predict_boosted_at(changed, 350))

    def test_zero_volume_and_zero_range_features_are_finite(self):
        bars = history(flat=True)
        for bar in bars:
            bar.update(o=100., h=100., l=100., c=100., v=0.)
        self.assertTrue(np.all(np.isfinite(market_features(bars, 350))))
        self.assertEqual(predict_boosted_at(bars, 350), 0.)

    def test_simulation_is_reproducible_and_quantiles_are_per_horizon(self):
        closes = np.array([b['c'] for b in history()])
        first = simulate(closes)
        np.testing.assert_array_equal(first, simulate(closes))
        self.assertEqual(first.shape, (5, 3))
        self.assertTrue(np.all(first[:, 0] <= first[:, 1]))
        self.assertTrue(np.all(first[:, 1] <= first[:, 2]))

    def test_invalid_short_duplicate_missing_future_and_stale_history_rejected(self):
        bars = history(); now = datetime(2026, 10, 3, tzinfo=timezone.utc)
        cases = [bars[:200], bars[:-1] + [bars[-2]], bars[:300] + bars[301:]]
        for bad in cases:
            with self.assertRaises(ValueError): validate_bars(bad, now)
        for key, value in [('c', float('nan')), ('c', -1), ('h', .01), ('t', now.timestamp() * 1000 + 1000)]:
            bad = [dict(b) for b in bars]; bad[-1][key] = value
            with self.assertRaises(ValueError): validate_bars(bad, now)
        with self.assertRaises(ValueError): validate_bars(bars, datetime(2026, 10, 20, tzinfo=timezone.utc))


if __name__ == '__main__': unittest.main()
