#!/bin/bash
cd /home/runner/workspace
exec python -m uvicorn backend.main:app --host 0.0.0.0 --port 8080 --reload
