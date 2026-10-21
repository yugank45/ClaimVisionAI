# ClaimVision AI

ClaimVision AI is an AI-powered multimodal insurance evidence verification application. It combines a React/Vite dashboard with a FastAPI backend to upload claim data, analyze supporting images with a vision model, review claim decisions, and export processing results.

## Features

- Upload claim, user-history, and evidence-requirements CSV files
- Upload claim images as a ZIP archive
- Process claims with multimodal AI image analysis
- Review claim status, severity, risk flags, evidence requirements, and image-level findings
- Filter claims and view claim-level details
- View processing progress and analytics
- Download processed claims as `output/output.csv`
- Serve the built frontend from the FastAPI backend in production

## Technology

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, TanStack Query
- **Backend:** Python, FastAPI, Uvicorn
- **AI integration:** OpenAI-compatible vision APIs
- **Data processing:** Pandas, NumPy, Pillow, OpenCV

## Requirements

- Node.js 18 or newer
- Python 3.11 or newer
- An API key from OpenAI, OpenRouter, or Groq for claim processing

## Local development

### 1. Install dependencies

From the repository root, install the frontend and backend dependencies:

```bash
npm install
python -m pip install -r requirements.txt
```

Using a Python virtual environment is recommended:

```bash
python -m venv .venv
```

Activate it before installing the Python dependencies:

```powershell
# Windows PowerShell
.venv\Scripts\Activate.ps1
```

```bash
# macOS/Linux
source .venv/bin/activate
```

### 2. Configure the AI provider

Set `OPENAI_API_KEY` in the shell that runs the backend. The backend selects the provider from the key format:

- `sk-or-...` uses OpenRouter
- `gsk_...` uses Groq
- Other keys use the OpenAI API

```powershell
# Windows PowerShell
$env:OPENAI_API_KEY = "your_api_key"
```

```cmd
:: Windows Command Prompt
set OPENAI_API_KEY=your_api_key
```

```bash
# macOS/Linux
export OPENAI_API_KEY="your_api_key"
```

Do not commit API keys or place them in frontend source code.

### 3. Start the backend

In one terminal:

```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload
```

The backend API is available at `http://localhost:8080`. Verify it is running at `http://localhost:8080/api/healthz`.

### 4. Start the frontend

In a second terminal:

```bash
npm run dev
```

Open [http://localhost:5000](http://localhost:5000). The Vite development server proxies `/api` requests to the backend on port 8080.

## Demo accounts

Authentication is implemented in the browser for the demo application. It is not a production authentication system.

| Email | Password | Role |
|---|---|---|
| `adjuster@claimvision.ai` | `demo2024` | Claims Adjuster |
| `admin@claimvision.ai` | `admin2024` | Admin |

New accounts created through the sign-up form are stored in the browser's local storage.

## Typical workflow

1. Sign in with a demo account or create a local demo account.
2. Open **Upload** and provide the claim CSV and supporting image ZIP.
3. Select the dataset and start processing.
4. Monitor progress on the processing screen.
5. Review claims, claim details, analytics, and image-level evidence.
6. Download the generated CSV from the claims workflow.

The repository includes sample data under [`dataset/`](./dataset). Processing writes generated results to [`output/`](./output).

## API endpoints

The FastAPI application exposes these routes under `/api`:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/healthz` | Backend health check |
| GET | `/claims` | List claims with optional status, severity, and object filters |
| GET | `/claims/{claim_id}` | Get one claim |
| POST | `/upload-dataset` | Upload claim-related CSV files |
| POST | `/upload-images-zip` | Upload claim images |
| POST | `/process-claims` | Start background claim processing |
| GET | `/processing-status` | Get processing progress |
| GET | `/analytics` | Get claim analytics |
| GET | `/dataset-info` | Get dataset metadata |
| GET | `/image-coverage` | Check image coverage for claims |
| GET | `/download-output` | Download the generated CSV |

Interactive API documentation is available at [http://localhost:8080/docs](http://localhost:8080/docs) while the backend is running.

## Production build

Build the frontend with:

```bash
npm run build
```

When the generated `dist/` directory is present, the FastAPI backend serves the frontend from the same process:

```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8080
```

For a frontend-only preview of the production build:

```bash
npm run preview
```

## Project structure

```text
backend/        FastAPI application, routes, models, and AI services
dataset/        Sample CSV files and claim images
output/         Generated processing output
public/         Static frontend assets
src/            React pages, components, API client, and application state
```

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite development server on port 5000 |
| `npm run build` | Build the frontend into `dist/` |
| `npm run preview` | Preview the production frontend build |
