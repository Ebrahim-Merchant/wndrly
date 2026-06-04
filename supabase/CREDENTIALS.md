# Supabase Project Credentials
# Project: wndrly (xfvayfokefudhxtlcprj)
# Created: 2026-06-03
# Region: us-east-1

SUPABASE_PROJECT_REF=xfvayfokefudhxtlcprj
SUPABASE_PROJECT_URL=https://xfvayfokefudhxtlcprj.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmdmF5Zm9rZWZ1ZGh4dGxjcHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDM5MTIsImV4cCI6MjA5NjAxOTkxMn0.w9DGq5fk3cUqgQV6um3HM2U5gFdbyjqbGTRzVv2ip_w
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmdmF5Zm9rZWZ1ZGh4dGxjcHJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ0MzkxMiwiZXhwIjoyMDk2MDE5OTEyfQ.BG5tiQpXlENB7tqOk2sLlQHfRbFyc0K_EpFtuPGqsFs
SUPABASE_DB_PASSWORD=WndrlySupa2024!SecurePass

# Connection strings for DATABASE_URL env var in docker-compose
# Transaction pooler (WORKING - aws-1 host, port 5432 SESSION mode):
DATABASE_URL=postgresql://postgres.xfvayfokefudhxtlcprj:WndrlySupa2024!SecurePass@aws-1-us-east-1.pooler.supabase.com:5432/postgres
# NOTE: Do NOT include ?sslmode=require - let pg Pool handle SSL with rejectUnauthorized: false
# The correct pooler host is aws-1, NOT aws-0
# Old password WndrlySupa2025Reset! in ~/.openclaw/secrets/.env.wndrly-supabase is WRONG, actual password is above

# Transaction pooler (for serverless/short-lived):
# DATABASE_URL=postgresql://postgres.xfvayfokefudhxtlcprj:WndrlySupa2024!SecurePass@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require

# Direct connection (IPv6 only - use if server supports IPv6):
# DATABASE_URL=postgresql://postgres:WndrlySupa2024!SecurePass@db.xfvayfokefudhxtlcprj.supabase.co:5432/postgres?sslmode=require

# Dashboard:
# https://supabase.com/dashboard/project/xfvayfokefudhxtlcprj

# Supabase API key (for management):
# SUPABASE_API_KEY=sbp_REDACTED (stored in ~/.openclaw/secrets/.env.wndrly-supabase)
