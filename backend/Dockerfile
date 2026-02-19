FROM python:3.11-slim

WORKDIR /app

# Copy and install dependencies first (faster rebuilds)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the code
COPY . .

EXPOSE 8080

# uvicorn is the server that runs FastAPI
# --host 0.0.0.0 means accept connections from anywhere
# --port 8080 matches Railway's default port
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
