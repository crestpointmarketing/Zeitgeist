FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    DSA_REPO_PATH=/opt/daily_stock_analysis PORT=8001
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && git init /opt/daily_stock_analysis \
    && git -C /opt/daily_stock_analysis remote add origin https://github.com/crestpointmarketing/daily_stock_analysis.git \
    && git -C /opt/daily_stock_analysis fetch --depth 1 origin be148f39ce3be8bc7f9c2d5b0ad77cd31655e78f \
    && git -C /opt/daily_stock_analysis checkout --detach FETCH_HEAD \
    && rm -rf /opt/daily_stock_analysis/.git /var/lib/apt/lists/*

COPY integrations/dsa/requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt
COPY integrations/dsa/*.py /app/integrations/dsa/
COPY integrations/prediction/*.py /app/integrations/prediction/
COPY integrations/prediction/LICENSE integrations/prediction/PROVENANCE.md integrations/prediction/SOURCE_MANIFEST.json /app/integrations/prediction/
RUN useradd --create-home --uid 10001 app && chown -R app:app /app /opt/daily_stock_analysis
USER app
EXPOSE 8001
CMD ["sh", "-c", "exec python -m uvicorn bridge:app --app-dir integrations/dsa --host 0.0.0.0 --port ${PORT:-8001} --workers 1"]
