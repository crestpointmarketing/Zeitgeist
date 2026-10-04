# Third-fork coverage — 2026-10-04

Source: `crestpointmarketing/Stock-Prediction-Models` at `33266732b0b16188b565e0aeb6b24efa71161f6a` (Apache-2.0).

The web research catalog now contains 29 selectable modules: 18 sequence architectures, one autoencoder, five classical/stacking routes, four paper strategies and one risk module. The previously deployed tree ensemble, Gradient Boosting comparator and Monte Carlo view remain. Portfolio optimization is an additional offline CLI.

This is broad architectural reuse, **not a claim that every original program was migrated or that its accuracy was reproduced**. The static inventory records all 70 Python/notebook source files, hashes, class names and decisions; parsing a file is not a deep manual audit. Raw bundled data, generated notebook outputs and legacy web servers are not runtime inputs.

## Coverage decisions

| Status | Source files | Meaning |
| --- | ---: | --- |
| architecture rewritten | 20 | Modern bounded implementation; topology/training differs from legacy TensorFlow. |
| family adaptation | 3 | Related policy family, not identical agent (notably tabular Q-learning). |
| not migrated | 24 | 24 individual RL/novelty/Bayesian/live-agent variants remain future research. |
| offline adaptation | 1 | Portfolio study from explicit local data; not an online account tool. |
| partially adapted | 5 | Useful components adopted; original combined pipeline or analyses not reproduced wholesale. |
| reference only | 12 | Dataset-specific, supporting, sentiment-dependent or non-stock examples without matching validated inputs. |
| simulation adapted | 3 | Modern illustrative scenarios; not calibrated uncertainty. |
| strategy adapted | 2 | Historical next-open paper execution with costs and held-out accounting. |

## Per-file mapping

| Upstream path | Status | Current module |
| --- | --- | --- |
| `agent/1.turtle-agent.ipynb` | strategy adapted | paper_turtle |
| `agent/10.duel-q-learning-agent.ipynb` | not migrated | — |
| `agent/11.double-duel-q-learning-agent.ipynb` | not migrated | — |
| `agent/12.duel-recurrent-q-learning-agent.ipynb` | not migrated | — |
| `agent/13.double-duel-recurrent-q-learning-agent.ipynb` | not migrated | — |
| `agent/14.actor-critic-agent.ipynb` | not migrated | — |
| `agent/15.actor-critic-duel-agent.ipynb` | not migrated | — |
| `agent/16.actor-critic-recurrent-agent.ipynb` | not migrated | — |
| `agent/17.actor-critic-duel-recurrent-agent.ipynb` | not migrated | — |
| `agent/18.curiosity-q-learning-agent.ipynb` | not migrated | — |
| `agent/19.recurrent-curiosity-q-learning-agent.ipynb` | not migrated | — |
| `agent/2.moving-average-agent.ipynb` | strategy adapted | paper_ma |
| `agent/20.duel-curiosity-q-learning-agent.ipynb` | not migrated | — |
| `agent/21.neuro-evolution-agent.ipynb` | not migrated | — |
| `agent/22.neuro-evolution-novelty-search-agent.ipynb` | not migrated | — |
| `agent/23.abcd-strategy-agent.ipynb` | not migrated | — |
| `agent/3.signal-rolling-agent.ipynb` | not migrated | — |
| `agent/4.policy-gradient-agent.ipynb` | not migrated | — |
| `agent/5.q-learning-agent.ipynb` | family adaptation | paper_qlearning |
| `agent/6.evolution-strategy-agent.ipynb` | family adaptation | paper_evolution |
| `agent/7.double-q-learning-agent.ipynb` | not migrated | — |
| `agent/8.recurrent-q-learning-agent.ipynb` | not migrated | — |
| `agent/9.double-recurrent-q-learning-agent.ipynb` | not migrated | — |
| `agent/updated-NES-google.ipynb` | not migrated | — |
| `deep-learning/1.lstm.ipynb` | architecture rewritten | lstm |
| `deep-learning/10.lstm-seq2seq.ipynb` | architecture rewritten | lstm_seq2seq |
| `deep-learning/11.bidirectional-lstm-seq2seq.ipynb` | architecture rewritten | bidirectional_lstm_seq2seq |
| `deep-learning/12.lstm-seq2seq-vae.ipynb` | architecture rewritten | lstm_vae |
| `deep-learning/13.gru-seq2seq.ipynb` | architecture rewritten | gru_seq2seq |
| `deep-learning/14.bidirectional-gru-seq2seq.ipynb` | architecture rewritten | bidirectional_gru_seq2seq |
| `deep-learning/15.gru-seq2seq-vae.ipynb` | architecture rewritten | gru_vae |
| `deep-learning/16.attention-is-all-you-need.ipynb` | architecture rewritten | transformer |
| `deep-learning/17.cnn-seq2seq.ipynb` | architecture rewritten | cnn_seq2seq |
| `deep-learning/18.dilated-cnn-seq2seq.ipynb` | architecture rewritten | dilated_cnn_seq2seq |
| `deep-learning/2.bidirectional-lstm.ipynb` | architecture rewritten | bidirectional_lstm |
| `deep-learning/3.lstm-2path.ipynb` | architecture rewritten | two_path_lstm |
| `deep-learning/4.gru.ipynb` | architecture rewritten | gru |
| `deep-learning/5.bidirectional-gru.ipynb` | architecture rewritten | bidirectional_gru |
| `deep-learning/6.gru-2path.ipynb` | architecture rewritten | two_path_gru |
| `deep-learning/7.vanilla.ipynb` | architecture rewritten | rnn |
| `deep-learning/8.bidirectional-vanilla.ipynb` | architecture rewritten | bidirectional_rnn |
| `deep-learning/9.vanilla-2path.ipynb` | architecture rewritten | two_path_rnn |
| `deep-learning/access.py` | reference only | — |
| `deep-learning/addressing.py` | reference only | — |
| `deep-learning/autoencoder.py` | architecture rewritten | autoencoder |
| `deep-learning/dnc.py` | reference only | — |
| `deep-learning/how-to-forecast.ipynb` | reference only | — |
| `deep-learning/sentiment-consensus.ipynb` | reference only | — |
| `deep-learning/util.py` | reference only | — |
| `free-agent/evolution-strategy-agent.ipynb` | family adaptation | paper_evolution |
| `free-agent/evolution-strategy-bayesian-agent.ipynb` | not migrated | — |
| `misc/bitcoin-analysis-lstm.ipynb` | reference only | — |
| `misc/fashion-forecasting.ipynb` | reference only | — |
| `misc/kijang-emas-bank-negara.ipynb` | reference only | — |
| `misc/outliers.ipynb` | partially adapted | risk_diagnostics |
| `misc/overbought-oversold.ipynb` | partially adapted | risk_diagnostics |
| `misc/tesla-study.ipynb` | reference only | — |
| `misc/which-stock.ipynb` | reference only | — |
| `realtime-agent/app.py` | not migrated | — |
| `realtime-agent/realtime-evolution-strategy.ipynb` | not migrated | — |
| `realtime-agent/request.ipynb` | not migrated | — |
| `simulation/monte-carlo-drift.ipynb` | simulation adapted | primary simulation |
| `simulation/monte-carlo-dynamic-volatility.ipynb` | simulation adapted | risk_diagnostics |
| `simulation/monte-carlo-simple.ipynb` | simulation adapted | primary simulation |
| `simulation/multivariate-drift-monte-carlo.ipynb` | reference only | — |
| `simulation/portfolio-optimization.ipynb` | offline adaptation | portfolio_research.py |
| `stacking/autoencoder.py` | architecture rewritten | autoencoder |
| `stacking/model.py` | partially adapted | temporal_stack / classical catalog |
| `stacking/stack-encoder-ensemble-xgb.ipynb` | partially adapted | temporal_stack / classical catalog |
| `stacking/stack-rnn-arima-xgb.ipynb` | partially adapted | temporal_stack / classical catalog |

## Boundaries

The old agents are not relabeled as finished. Porting the remaining variants needs a separate validated training environment, compute budgets and individual evaluation. No live broker, reinforcement-learning trading service, social sentiment feed, or original historical accuracy claim is enabled. The source manifest is documentation, not executable trust. See [PROVENANCE.md](PROVENANCE.md) for exact rewritten protocols and [RESEARCH-VERIFICATION.md](RESEARCH-VERIFICATION.md) for actual tests.
