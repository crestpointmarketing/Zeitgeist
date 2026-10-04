export const RESEARCH_MODELS = {
  lstm: ['LSTM', 'Sequence networks'], bidirectional_lstm: ['Bidirectional LSTM', 'Sequence networks'], two_path_lstm: ['Two-path LSTM', 'Sequence networks'],
  gru: ['GRU', 'Sequence networks'], bidirectional_gru: ['Bidirectional GRU', 'Sequence networks'], two_path_gru: ['Two-path GRU', 'Sequence networks'],
  rnn: ['Vanilla RNN', 'Sequence networks'], bidirectional_rnn: ['Bidirectional RNN', 'Sequence networks'], two_path_rnn: ['Two-path RNN', 'Sequence networks'],
  lstm_seq2seq: ['LSTM encoder–decoder', 'Sequence networks'], bidirectional_lstm_seq2seq: ['Bidirectional LSTM encoder–decoder', 'Sequence networks'], lstm_vae: ['Variational LSTM', 'Sequence networks'],
  gru_seq2seq: ['GRU encoder–decoder', 'Sequence networks'], bidirectional_gru_seq2seq: ['Bidirectional GRU encoder–decoder', 'Sequence networks'], gru_vae: ['Variational GRU', 'Sequence networks'],
  transformer: ['Attention / Transformer', 'Sequence networks'], cnn_seq2seq: ['CNN encoder–decoder', 'Sequence networks'], dilated_cnn_seq2seq: ['Dilated CNN encoder–decoder', 'Sequence networks'],
  autoencoder: ['Autoencoder + Ridge', 'Classical & stacking'], adaboost: ['AdaBoost', 'Classical & stacking'], bagging: ['Bagging', 'Classical & stacking'],
  xgboost: ['XGBoost', 'Classical & stacking'], arima: ['ARIMA (1,1,0)', 'Classical & stacking'], temporal_stack: ['Temporal stacking', 'Classical & stacking'],
  paper_ma: ['Moving-average strategy', 'Paper strategies'], paper_turtle: ['Turtle breakout strategy', 'Paper strategies'],
  paper_evolution: ['Evolution strategy', 'Paper strategies'], paper_qlearning: ['Tabular Q-learning strategy', 'Paper strategies'],
  risk_diagnostics: ['Dynamic volatility & outliers', 'Risk exploration'],
} as const;
export type ResearchModel = keyof typeof RESEARCH_MODELS;
export function isResearchModel(value: unknown): value is ResearchModel {
  return typeof value === 'string' && Object.hasOwn(RESEARCH_MODELS, value);
}
