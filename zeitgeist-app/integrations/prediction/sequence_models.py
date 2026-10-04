"""Modern CPU rewrites of the fork's sequence/encoder architecture families.

See PROVENANCE.md: these are bounded research adaptations, not reproduced upstream
accuracy claims. Every fit starts from scratch; only mature training rows are used.
"""
import numpy as np
import torch
from torch import nn
from sklearn.linear_model import Ridge

torch.set_num_threads(1)
NEURAL_MODELS = (
    'lstm', 'bidirectional_lstm', 'two_path_lstm',
    'gru', 'bidirectional_gru', 'two_path_gru',
    'rnn', 'bidirectional_rnn', 'two_path_rnn',
    'lstm_seq2seq', 'bidirectional_lstm_seq2seq', 'lstm_vae',
    'gru_seq2seq', 'bidirectional_gru_seq2seq', 'gru_vae',
    'transformer', 'cnn_seq2seq', 'dilated_cnn_seq2seq', 'autoencoder',
)
EPOCHS, HIDDEN, TRAIN_ROWS, LOOKBACK = 12, 12, 252, 20


class SequenceNetwork(nn.Module):
    def __init__(self, name):
        super().__init__()
        self.name = name
        self.variational = name.endswith('_vae')
        self.decode = 'seq2seq' in name or self.variational
        self.two_path = name.startswith('two_path')
        self.bidirectional = name.startswith('bidirectional')
        self.penalty = torch.tensor(0.)
        if name == 'transformer':
            self.project = nn.Linear(3, HIDDEN)
            position = torch.arange(LOOKBACK).float().unsqueeze(1)
            scale = torch.exp(torch.arange(0, HIDDEN, 2).float() * (-np.log(10000.) / HIDDEN))
            pe = torch.zeros(LOOKBACK, HIDDEN)
            pe[:, 0::2], pe[:, 1::2] = torch.sin(position * scale), torch.cos(position * scale)
            self.register_buffer('position', pe)
            self.encoder = nn.TransformerEncoder(nn.TransformerEncoderLayer(
                HIDDEN, 2, dim_feedforward=24, dropout=0., batch_first=True), 1,
                enable_nested_tensor=False)
            width = HIDDEN
        elif 'cnn' in name:
            # Left padding only: convolutions never access later sequence steps.
            layers = []
            for i, dilation in enumerate([1, 2, 4] if name.startswith('dilated') else [1, 1]):
                layers += [nn.ConstantPad1d((2 * dilation, 0), 0),
                           nn.Conv1d(3 if i == 0 else HIDDEN, HIDDEN, 3, dilation=dilation), nn.Tanh()]
            self.encoder = nn.Sequential(*layers)
            width = HIDDEN
        else:
            cell = nn.LSTM if 'lstm' in name else nn.GRU if 'gru' in name else nn.RNN
            self.encoder = cell(3, HIDDEN, batch_first=True, bidirectional=self.bidirectional)
            if self.two_path:
                self.short_encoder = cell(3, HIDDEN, batch_first=True)
            width = HIDDEN * (2 if self.bidirectional or self.two_path else 1)
        if self.variational:
            self.mean, self.logvar = nn.Linear(width, HIDDEN), nn.Linear(width, HIDDEN)
            width = HIDDEN
        self.context = nn.Linear(width, HIDDEN)
        if self.decode:
            self.decoder = (nn.LSTM if 'lstm' in name else nn.GRU)(HIDDEN, HIDDEN, batch_first=True)
            self.step = nn.Parameter(torch.zeros(5, HIDDEN))
            self.output = nn.Linear(HIDDEN, 1)
        else:
            self.output = nn.Linear(HIDDEN, 5)

    def forward(self, x):
        if self.name == 'transformer':
            z = self.encoder(self.project(x) + self.position)[:, -1]
        elif 'cnn' in self.name:
            z = self.encoder(x.transpose(1, 2))[:, :, -1]
        else:
            _, state = self.encoder(x)
            hidden = state[0] if isinstance(state, tuple) else state
            z = torch.cat([hidden[-2], hidden[-1]], dim=1) if self.bidirectional else hidden[-1]
            if self.two_path:
                _, short = self.short_encoder(x[:, -5:])
                short = short[0] if isinstance(short, tuple) else short
                z = torch.cat([z, short[-1]], dim=1)
        if self.variational:
            mu, logvar = self.mean(z), self.logvar(z).clamp(-8, 8)
            self.penalty = .001 * (-.5 * (1 + logvar - mu.square() - logvar.exp()).mean())
            z = mu + torch.randn_like(mu) * (.5 * logvar).exp() if self.training else mu
        context = torch.tanh(self.context(z))
        if self.decode:
            state = (context[None], torch.zeros_like(context[None])) if isinstance(self.decoder, nn.LSTM) else context[None]
            decoded, _ = self.decoder(context[:, None, :].expand(-1, 5, -1) + self.step, state)
            return self.output(decoded).squeeze(-1)
        return self.output(context)


def sequence_rows(bars):
    close = np.array([b['c'] for b in bars], dtype=float)
    volume = np.log1p([b['v'] for b in bars])
    daily = np.column_stack([np.r_[0., np.diff(np.log(close))],
                            [(b['h'] - b['l']) / b['c'] for b in bars],
                            np.r_[0., np.diff(volume)]])
    return {i: daily[i - LOOKBACK + 1:i + 1] for i in range(LOOKBACK, len(bars))}


def training_arrays(bars, origin, rows=None):
    rows = rows if rows is not None else sequence_rows(bars)
    indices = np.arange(max(LOOKBACK, origin - 5 - TRAIN_ROWS + 1), origin - 5 + 1)
    if len(indices) < 200:
        raise ValueError('Insufficient mature sequence labels')
    close = np.array([b['c'] for b in bars], dtype=float)
    x = np.array([rows[int(i)] for i in indices], dtype=np.float32)
    y = np.array([np.diff(np.log(close[i:i + 6])) for i in indices], dtype=np.float32)
    # Statistics are fit on the training sequences only, never query/test rows.
    mean, scale = x.mean(axis=(0, 1)), np.maximum(x.std(axis=(0, 1)), 1e-6)
    ym, ys = y.mean(axis=0), np.maximum(y.std(axis=0), 1e-6)
    return ((x - mean) / scale, (y - ym) / ys,
            (rows[origin][None].astype(np.float32) - mean) / scale, ym, ys, indices)


def predict_sequence(bars, origin, name, rows=None):
    if name not in NEURAL_MODELS:
        raise ValueError('Unsupported sequence model')
    torch.manual_seed(42)
    x, y, query, ym, ys, indices = training_arrays(bars, origin, rows)
    if name == 'autoencoder':
        # Train a real reconstruction bottleneck before a supervised Ridge head.
        flat, q = x.reshape(len(x), -1), query.reshape(1, -1)
        encoder = nn.Sequential(nn.Linear(60, 24), nn.Tanh(), nn.Linear(24, 6), nn.Tanh())
        network = nn.Sequential(encoder, nn.Linear(6, 24), nn.Tanh(), nn.Linear(24, 60))
        tensor = torch.from_numpy(flat)
        optimizer = torch.optim.Adam(network.parameters(), lr=.005)
        for _ in range(EPOCHS):
            optimizer.zero_grad(); loss = (network(tensor) - tensor).square().mean()
            loss.backward(); optimizer.step()
        with torch.no_grad():
            latent = encoder(tensor).numpy(); test = encoder(torch.from_numpy(q)).numpy()
        prediction = Ridge(alpha=10.).fit(latent, y).predict(test)[0]
    else:
        network = SequenceNetwork(name)
        optimizer = torch.optim.Adam(network.parameters(), lr=.005, weight_decay=.001)
        inputs, targets = torch.from_numpy(x), torch.from_numpy(y)
        network.train()
        for _ in range(EPOCHS):
            optimizer.zero_grad()
            loss = (network(inputs) - targets).square().mean() + network.penalty
            if not torch.isfinite(loss):
                raise ValueError('Nonfinite training loss')
            loss.backward(); nn.utils.clip_grad_norm_(network.parameters(), 1.); optimizer.step()
        network.eval()
        with torch.no_grad():
            prediction = network(torch.from_numpy(query))[0].numpy()
    path = np.expm1(np.cumsum(prediction * ys + ym)).astype(float)
    if not np.all(np.isfinite(path)) or np.any(path <= -1):
        raise ValueError('Invalid sequence forecast')
    return path, int(indices[-1] + 5)
