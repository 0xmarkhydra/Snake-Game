# Test Documentation

## Webhook Capture API Tests

### 1. E2E Tests (Jest)

File: `webhook-capture.e2e-spec.ts`

Chạy E2E tests với Jest:
```bash
pnpm test:e2e
```

Tests bao gồm:
- ✅ POST /webhook/capture - Capture webhook data
- ✅ POST /webhook/capture - With body.url
- ✅ POST /webhook/capture - Minimal data
- ✅ GET /webhook/logs - Get all logs with pagination
- ✅ GET /webhook/logs - Filter by bodyDataUrl
- ✅ GET /webhook/logs - Filter by bodyUrl  
- ✅ GET /webhook/logs - Pagination test
- ✅ GET /webhook/logs/:id - Get by ID
- ✅ GET /webhook/logs/:id - 404 test
- ✅ Integration test - Full flow

### 2. Quick Test Script

File: `test-webhook-with-input.ts`

Test nhanh với input.1.json:
```bash
# Make sure server is running first!
pnpm start:dev

# Then in another terminal:
pnpm test:webhook
```

Script này sẽ:
1. Load file `docs/inputs/input.1.json`
2. POST data vào `/webhook/capture`
3. Verify data được extract đúng
4. Test GET logs với pagination
5. Test GET log by ID
6. Test filters
7. Test với custom data

### 3. Manual Testing với cURL

**Capture webhook data:**
```bash
curl -X POST http://localhost:3000/webhook/capture \
  -H "Content-Type: application/json" \
  -d @docs/inputs/input.1.json
```

**Get all logs:**
```bash
curl "http://localhost:3000/webhook/logs?page=1&take=10"
```

**Filter by URL:**
```bash
# Filter by body.data.url
curl "http://localhost:3000/webhook/logs?bodyDataUrl=graphql"

# Filter by body.url
curl "http://localhost:3000/webhook/logs?bodyUrl=x.com"

# Combine filters
curl "http://localhost:3000/webhook/logs?bodyUrl=x.com&bodyDataUrl=BroadcastQuery&take=20"
```

**Get by ID:**
```bash
curl "http://localhost:3000/webhook/logs/{log-id}"
```

### 4. Test với Postman/Insomnia

Import vào Postman hoặc Insomnia:

**Collection:**
- Name: Webhook Capture API
- Base URL: `http://localhost:3000`

**Endpoints:**

1. **POST /webhook/capture**
   - Method: POST
   - Body: raw JSON
   - Example body từ `docs/inputs/input.1.json`

2. **GET /webhook/logs**
   - Method: GET
   - Query Params:
     - page: 1
     - take: 10
     - bodyUrl: (optional)
     - bodyDataUrl: (optional)

3. **GET /webhook/logs/:id**
   - Method: GET
   - Path variable: id

## Environment Variables

Để test với server khác:
```bash
API_URL=http://your-server:3000 pnpm test:webhook
```

## Expected Results

### Successful Capture Response:
```json
{
  "id": "uuid-here",
  "body_url": null,
  "body_data_url": "https://x.com/i/api/graphql/...",
  "body_data_response": {
    "data": {
      "broadcast": { ... }
    }
  },
  "notes": null,
  "created_at": "2025-10-01T...",
  "updated_at": "2025-10-01T..."
}
```

### Logs List Response:
```json
{
  "items": [
    { ... },
    { ... }
  ],
  "pagination": {
    "page": 1,
    "take": 10,
    "total": 42
  }
}
```

## Troubleshooting

**Server not running:**
```bash
pnpm start:dev
```

**Database not setup:**
```bash
# Check your .env file has correct database config
# Run migrations if needed
```

**Connection refused:**
- Check if server is running on port 3000
- Check firewall settings
- Try: `curl http://localhost:3000/health`

