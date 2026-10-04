export async function requestForecast(ticker: string, signal: AbortSignal, request = fetch) {
  const deadline = AbortSignal.timeout(55_000);
  try {
    const response = await request('/api/forecast', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker }), signal: AbortSignal.any([signal, deadline]),
    });
    let body;
    try { body = await response.json(); }
    catch { throw new Error('The experiment service returned an unreadable response. Please retry shortly.'); }
    if (!response.ok || !body?.success) {
      const fallback = response.status === 401 ? 'Sign in again to run the experiment.'
        : response.status === 429 ? 'The experiment service is busy or a request limit was reached. Please retry shortly.'
        : 'Experiment unavailable. Please retry later.';
      throw new Error(typeof body?.error?.message === 'string' ? body.error.message : fallback);
    }
    if (signal.aborted) throw signal.reason;
    try { const { parseForecast } = await import('./forecast-schema'); return parseForecast(body.data, ticker); }
    catch { throw new Error('This experiment result is incomplete or out of date. Please run it again.'); }
  } catch (error) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (deadline.aborted) throw new Error('The experiment took longer than 55 seconds. Please retry shortly; your previous result is kept.');
    throw error;
  }
}
