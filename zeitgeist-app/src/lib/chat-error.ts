export function friendlyChatError(error:Error):string {
  try {
    const parsed=JSON.parse(error.message);
    if(typeof parsed?.error==='string')return parsed.error;
    if(typeof parsed?.error?.message==='string')return parsed.error.message;
  } catch { /* Plain text transport error. */ }
  return error.message||'The answer could not be completed. Please try again.';
}
