# Notes Database Commands

This document provides common PostgreSQL commands for managing the notes database.

## Database Connection

The application automatically connects to PostgreSQL using environment variables:
- `DATABASE_URL` - Complete connection string
- `PGHOST` - Database host
- `PGPORT` - Database port
- `PGUSER` - Database user
- `PGPASSWORD` - Database password
- `PGDATABASE` - Database name

## Connecting to Database

### Using psql command line:
```bash
psql $DATABASE_URL
```

Or using individual environment variables:
```bash
psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE
```

## Common Database Commands

### View all tables:
```sql
\dt
```

### Describe the notes_records table:
```sql
\d notes_records
```

### View all notes:
```sql
SELECT * FROM notes_records ORDER BY updated_at DESC;
```

### View recent notes (last 10):
```sql
SELECT id, note_title, LEFT(note_content, 50) as preview, created_at 
FROM notes_records 
ORDER BY created_at DESC 
LIMIT 10;
```

### Count total notes:
```sql
SELECT COUNT(*) as total_notes FROM notes_records;
```

### Search notes by title:
```sql
SELECT * FROM notes_records 
WHERE note_title ILIKE '%search_term%' 
ORDER BY updated_at DESC;
```

### Search notes by content:
```sql
SELECT * FROM notes_records 
WHERE note_content ILIKE '%search_term%' 
ORDER BY updated_at DESC;
```

### View notes created today:
```sql
SELECT * FROM notes_records 
WHERE DATE(created_at) = CURRENT_DATE 
ORDER BY created_at DESC;
```

### View notes modified in the last hour:
```sql
SELECT * FROM notes_records 
WHERE updated_at > NOW() - INTERVAL '1 hour' 
ORDER BY updated_at DESC;
```

## Database Schema

The `notes_records` table structure:

```sql
CREATE TABLE notes_records (
    id SERIAL PRIMARY KEY,
    note_title VARCHAR(255) NOT NULL,
    note_content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notes_records_created_at ON notes_records(created_at DESC);
```

## Maintenance Commands

### Check database size:
```sql
SELECT pg_size_pretty(pg_database_size(current_database())) as database_size;
```

### Check table size:
```sql
SELECT pg_size_pretty(pg_total_relation_size('notes_records')) as table_size;
```

### Vacuum the table (clean up):
```sql
VACUUM ANALYZE notes_records;
```

## Backup and Restore

### Create a backup:
```bash
pg_dump $DATABASE_URL > notes_backup.sql
```

### Restore from backup:
```bash
psql $DATABASE_URL < notes_backup.sql
```

## Advanced Queries

### Notes with character count:
```sql
SELECT id, note_title, LENGTH(note_content) as char_count, created_at 
FROM notes_records 
ORDER BY char_count DESC;
```

### Average note length:
```sql
SELECT AVG(LENGTH(note_content)) as avg_note_length 
FROM notes_records;
```

### Notes created per day (last 30 days):
```sql
SELECT DATE(created_at) as date, COUNT(*) as notes_count 
FROM notes_records 
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at) 
ORDER BY date DESC;
```

### Find longest notes:
```sql
SELECT id, note_title, LENGTH(note_content) as length, created_at 
FROM notes_records 
ORDER BY length DESC 
LIMIT 5;
```

## Troubleshooting

### Check if table exists:
```sql
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'notes_records'
);
```

### Check table permissions:
```sql
SELECT * FROM information_schema.table_privileges 
WHERE table_name = 'notes_records';
```

### View recent database activity:
```sql
SELECT * FROM pg_stat_activity WHERE datname = current_database();
```