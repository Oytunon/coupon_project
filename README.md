# Coupon Project

## Overview
This project is a betting coupon tracking system that fetches user bet history from an external provider (BetConstruct based) and stores it for analysis. It includes an Admin Dashboard for monitoring.

## Project Structure
- `backend_api/`: FastAPI backend service (Port 8001).
- `worker/`: Background worker for fetching coupons (logic isolated).
- `shared/`: Centralized domain models, business logic (scoring engine), and services (BetConstruct, Email).
- `admin_frontend/`: Management dashboard for admins (Port 5173).
- `client_frontend/`: Participant dashboard for users (Port 5175).
- `tests/`: Pytest suite for API and Domain logic.

## Setup & Running

### Prerequisites
- Docker & Docker Compose
- Python 3.11+ (for local dev)
- Node.js 18+ (for local dev)

### Docker (Recommended)
1. Create a `.env` file from `.env.example`.
2. Build and run:
   ```bash
   docker-compose up --build
   ```
3. Access:
   - Frontend: http://localhost:3000
   - API Docs: http://localhost:8000/docs
   - Admin Login: Use the API Key defined in `.env`.

### Local Development

#### API
```bash
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate
pip install -r api/requirements.txt
uvicorn backend_api.app.main:app --reload
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

#### Worker
```bash
# Run once for testing
python worker/main.py --once
```

## Testing
Run the test suite:
```bash
pip install -r api/requirements.txt
pip install pytest httpx
pytest tests/
```

## Database Migrations

This project uses **Alembic** for database schema management.

### First Time Setup
```bash
# 1. Activate virtual environment
.\.venv\Scripts\Activate.ps1  # Windows
# source .venv/bin/activate    # Linux/Mac

# 2. Start database (if using Docker)
docker-compose up -d postgres

# 3. Run migrations
alembic upgrade head
```

### Common Migration Commands
```bash
# Check current migration status
alembic current

# View migration history
alembic history

# Create new migration (after model changes)
python tools/migration_helper.py create "description"
# OR
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

### Helper Script
For easier migration management, use the helper script:
```bash
python tools/migration_helper.py status     # Check status
python tools/migration_helper.py create "msg"  # Create migration
python tools/migration_helper.py upgrade    # Apply migrations
python tools/migration_helper.py test       # Test migrations
```

### Documentation
- [Alembic Usage Guide (Turkish)](docs/alembic_kullanim.md) - Comprehensive guide
- [Migration Workflow](docs/migration_workflow.md) - Step-by-step workflows
- [Migration FAQ](docs/migration_faq.md) - Common issues and solutions

## Security
- The Admin Panel is protected by an API Key (`API_TOKEN` in `.env`).
- Ensure `DATABASE_URL` is set correctly.
- **Always backup your database before running migrations in production!**

