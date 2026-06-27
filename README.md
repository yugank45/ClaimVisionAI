# ClaimVision AI — Local Setup

## Requirements
- Python 3.11+
- Node.js 18+

## Frontend (Terminal 1)
```
npm install
npm run dev
```
Open http://localhost:5173

## Backend (Terminal 2)
```
pip install -r requirements.txt
set OPENAI_API_KEY=your_groq_key_here   (Windows)
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload
```

## Demo Login
- Email: adjuster@claimvision.ai
- Password: demo2024
