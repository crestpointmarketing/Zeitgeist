/** Safe provider diagnostics. Never send provider bodies, headers or credentials to the browser. */
export class AIServiceError extends Error {
  constructor(public code: string, message: string, public status = 503) { super(message); }
}

export function aiServiceError(error: unknown): AIServiceError {
  if (error instanceof AIServiceError) return error;
  const details = error && typeof error === 'object' ? error as { status?: number; statusCode?: number; message?: string; name?: string } : {};
  const status = details.status ?? details.statusCode;
  const message = typeof details.message === 'string' ? details.message.toLowerCase() : '';
  if (status === 401) return new AIServiceError('provider_auth', 'AI service authentication failed. The site administrator needs to update the AI API key. Stock prices remain available.');
  if (status === 403) return new AIServiceError('provider_permission', 'The AI provider denied access. The site administrator needs to check provider permissions. Stock prices remain available.');
  if (status === 429 || status === 529) return new AIServiceError('provider_capacity', 'The AI provider is busy or has reached its request limit. Please retry later. Stock prices remain available.');
  if (status === 400 && /credit|balance|billing/.test(message)) return new AIServiceError('provider_billing', 'AI service billing needs attention from the site administrator. Stock prices remain available.');
  if (status === 404 || (status === 400 && /model/.test(message))) return new AIServiceError('provider_model', 'The configured AI model is unavailable. The site administrator needs to check the model configuration. Stock prices remain available.');
  if (/timeout|timed out/.test(message) || details.name === 'TimeoutError') return new AIServiceError('provider_timeout', 'AI analysis timed out. Your stock prices are ready; please retry the analysis.', 504);
  return new AIServiceError('analysis_unavailable', 'AI analysis could not be completed or did not pass validation. Your market data is available; retry analysis separately.', 502);
}
