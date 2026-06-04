# Abinet Connect - Complete Testing Guide

## Overview

This directory contains comprehensive testing documentation and automated test suites for the Abinet Connect employment marketplace application.

**Total Test Coverage**: 80+ test cases covering all endpoints, buttons, and workflows

## Quick Start

### Prerequisites
- Python 3.11+
- Backend running on `http://127.0.0.1:8080`
- `requests` library: `pip install requests`

### Run All Tests

```bash
# Method 1: Run Python test suite
python3 tests/test_suite.py

# Method 2: Run automated test script (includes frontend guide)
bash tests/run_tests.sh

# Method 3: View frontend testing checklist
python3 tests/frontend_test_guide.py
```

## Test Files

### 1. `test_suite.py` - Automated API Tests

**Purpose**: Tests all backend endpoints programmatically

**Coverage**:
- ✅ Health check & bootstrap
- ✅ User registration (worker, employer, broker)
- ✅ Authentication & login
- ✅ Job posting & management
- ✅ Job applications
- ✅ Worker verification
- ✅ Placements & commissions
- ✅ Payments
- ✅ Support tickets & compliance
- ✅ Profile management
- ✅ Error handling & edge cases

**Run**:
```bash
python3 tests/test_suite.py
```

**Expected Output**:
```
✓ PASS: Health check - API is running
✓ PASS: Bootstrap - All required fields present
✓ PASS: Register worker_1 (ID: worker-xxx...)
✓ PASS: Login worker_1
...
[Summary]
Passed: 60
Failed: 0
Success Rate: 100.0%
```

### 2. `frontend_test_guide.py` - Manual Frontend Testing

**Purpose**: Step-by-step guide for testing all UI buttons and forms

**Sections**:
1. Overview page buttons (register, sign-in, role picker)
2. Employer workspace (post jobs, view applicants)
3. Worker workspace (browse jobs, apply, search)
4. Broker workspace (placements, payments)
5. Support workspace (tickets, compliance, safety)
6. Account dashboard (profile, notifications, logout)
7. Admin portal (verification, applications, categories)
8. Navigation & routing
9. Error handling & validation
10. Data consistency

**Run**:
```bash
python3 tests/frontend_test_guide.py

# Or view specific section
python3 tests/frontend_test_guide.py | grep "SECTION 1"
```

### 3. `run_tests.sh` - Complete Test Execution

**Purpose**: Orchestrates all tests and generates reports

**Features**:
- Checks backend is running
- Generates test data
- Runs Python test suite
- Displays frontend guide
- Generates test report

**Run**:
```bash
chmod +x tests/run_tests.sh
bash tests/run_tests.sh
```

## Detailed Test Sections

### SECTION 0: Health & Bootstrap

| Test | Endpoint | Expected |
|------|----------|----------|
| Health check | GET /api/health | Status 200, "ok" |
| Bootstrap | GET /api/bootstrap | All data structures present |

### SECTION 1: User Registration

| Test | Action | Expected |
|------|--------|----------|
| Register worker | POST /api/users/register | 201, user + worker created |
| Register employer | POST /api/users/register | 201, user + broker created |
| Register broker | POST /api/users/register | 201, user + broker created |
| Duplicate phone | POST /api/users/register | 409, error |
| Duplicate username | POST /api/users/register | 409, error |
| Invalid data | POST /api/users/register | 400, error |

### SECTION 2: Authentication

| Test | Action | Expected |
|------|--------|----------|
| Valid login | POST /api/auth/login | 200, token + user |
| Invalid password | POST /api/auth/login | 401, error |
| Invalid username | POST /api/auth/login | 401, error |
| Get session | GET /api/auth/session | 200, user info |
| Rate limiting | 8+ logins in 15min | 429, rate limit |

### SECTION 3: Job Posting

| Test | Action | Expected |
|------|--------|----------|
| Post job | POST /api/jobs | 201, job created |
| Get jobs | GET /api/jobs | 200, all jobs |
| Filter by status | GET /api/jobs?status=Open | 200, filtered |
| Filter by category | GET /api/jobs?category=X | 200, filtered |
| Update status | PATCH /api/jobs/{id}/status | 200, updated |

### SECTION 4: Job Applications

| Test | Action | Expected |
|------|--------|----------|
| Apply for job | POST /api/applications | 201, application created |
| Get applications | GET /api/applications | 200, user's applications |
| Update status | PATCH /api/applications/{id}/status | 200, updated |
| Duplicate apply | POST /api/applications | 409, error |

### SECTION 5: Worker Management

| Test | Action | Expected |
|------|--------|----------|
| Get workers | GET /api/workers | 200, all workers |
| Filter by skill | GET /api/workers?skill=X | 200, filtered |
| Filter by location | GET /api/workers?location=X | 200, filtered |
| Filter by verification | GET /api/workers?verified=true | 200, filtered |
| Verify worker | PATCH /api/workers/{id}/verify | 200, verified |

### SECTION 6: Placements

| Test | Action | Expected |
|------|--------|----------|
| Create placement | POST /api/placements | 201, placement created |
| Get placements | GET /api/placements | 200, all placements |

### SECTION 7: Payments

| Test | Action | Expected |
|------|--------|----------|
| Create payment | POST /api/payments | 201, payment created |
| Get payments | GET /api/payments | 200, all payments |

### SECTION 8: Support & Compliance

| Test | Action | Expected |
|------|--------|----------|
| Create ticket | POST /api/support/tickets | 201, ticket created |
| Get tickets | GET /api/support/tickets | 200, all tickets |
| Create compliance | POST /api/compliance/requests | 201, created |
| Create safety report | POST /api/safety/reports | 201, created |

### SECTION 9: Profile Management

| Test | Action | Expected |
|------|--------|----------|
| Get profile | GET /api/auth/session | 200, user info |
| Update profile | PATCH /api/users/{id}/profile | 200, updated |
| Update identity | PATCH /api/users/{id}/profile | 200, updated |

## Manual Testing Checklist

### Pre-Testing Setup

- [ ] Backend running on port 8080
- [ ] Browser console open (F12)
- [ ] sessionStorage visible
- [ ] Network tab monitoring enabled

### Test Flow

#### 1. **Overview Page** (~5 minutes)
- [ ] Register button → Worker account created
- [ ] Sign in button → Login successful
- [ ] Role picker cards → All 3 update correctly
- [ ] Logo button → Returns to overview

#### 2. **Employer Workspace** (~10 minutes)
- [ ] Post job form → Job appears in list
- [ ] View job details → All fields visible
- [ ] Search filters → Working correctly

#### 3. **Worker Workspace** (~10 minutes)
- [ ] Browse available jobs → Shows open jobs
- [ ] Apply for job → Application submitted
- [ ] Try duplicate apply → Error appears
- [ ] Search workers → Filters work

#### 4. **Broker Workspace** (~5 minutes)
- [ ] Create placement → Placement appears
- [ ] Create payment → Invoice generated

#### 5. **Support Workspace** (~5 minutes)
- [ ] Open ticket → Ticket created
- [ ] Compliance request → Request created
- [ ] Safety report → Report created

#### 6. **Account Dashboard** (~5 minutes)
- [ ] View profile → All info populated
- [ ] Update profile → Changes saved
- [ ] View notifications → List displayed
- [ ] Logout → Session cleared

#### 7. **Admin Portal** (~10 minutes)
- [ ] Access staff portal → Login form appears
- [ ] Verify worker → Status changes
- [ ] Application queue → Buttons work
- [ ] Add category → Available in dropdown

#### 8. **Error Handling** (~5 minutes)
- [ ] Empty form → Validation error
- [ ] Duplicate phone → Error message
- [ ] Duplicate username → Error message
- [ ] Wrong password → 401 error

**Total Manual Testing Time**: ~55 minutes

## Automated Test Results Format

```
SUCCESS:
  ✓ PASS: Health check - API is running
  ✓ PASS: Register worker_1
  
FAILURE:
  ✗ FAIL: Update profile
    Reason: Status code 500, expected 200

SUMMARY:
  Passed: 60
  Failed: 2
  Total: 62
  Success Rate: 96.8%
```

## Test Data

Default test data created during tests:

```python
# Workers
- john.worker / password123
- jane.worker / password123

# Employers
- abc.restaurant / password123
- xyz.hotels / password123

# Brokers
- broker.agent / password123

# Staff (if applicable)
- admin / admin123
```

## Backend Requirements for Testing

Ensure `backend/app.py` has these environment variables for testing:

```bash
export HOST=127.0.0.1
export PORT=8080
export SESSION_TTL_MINUTES=120
export MAX_LOGIN_ATTEMPTS=8
export LOGIN_WINDOW_MINUTES=15
```

## Common Issues & Solutions

### Issue: "Backend not running"
```bash
# Solution:
python3 backend/app.py --port 8080
```

### Issue: "Port 8080 already in use"
```bash
# Solution:
python3 backend/app.py --port 8081
# Or kill process:
lsof -i :8080 | grep python | awk '{print $2}' | xargs kill
```

### Issue: "requests module not found"
```bash
pip install requests
```

### Issue: "Session storage not found in browser"
```bash
# Solution:
1. Open DevTools (F12)
2. Go to Application tab
3. Check Session Storage → http://127.0.0.1:8080
```

## Continuous Integration

To run tests in CI/CD pipeline:

```bash
#!/bin/bash
# Start backend
python3 backend/app.py &
BACKEND_PID=$!

# Wait for backend
sleep 2

# Run tests
python3 tests/test_suite.py
TEST_RESULT=$?

# Cleanup
kill $BACKEND_PID

exit $TEST_RESULT
```

## Test Metrics

### Code Coverage
- **Endpoints**: 25+ API routes
- **Functions**: 40+ backend functions
- **Components**: All major UI components tested
- **User Flows**: 15+ complete workflows

### Performance Baseline
- Average request: <100ms
- Health check: <50ms
- Bootstrap: <200ms
- Registration: <150ms

## Reporting Issues

When a test fails, capture:

1. **Error message**: Full stack trace
2. **Request/Response**: Headers and body
3. **Browser console**: Any JS errors
4. **Network tab**: Request timeline
5. **Data state**: Current data.json state

Example issue report:
```
Test: Apply for job
Status: FAILED
Error: 409 Conflict - "You already applied for this job"
Expected: 201 Created
Data: {jobId: "job-123", message: "..."}
Timestamp: 2024-06-04 10:30:45
```

## Test Maintenance

- Update tests when API changes
- Add tests for new features
- Review test data regularly
- Keep test documentation current
- Run tests before each deployment

## Additional Resources

- Backend API docs: See `backend/app.py` comments
- Frontend code: `frontend/app.js`
- Data schema: `backend/data.json`
- Deployment guide: `deploy/README.md`

---

**Last Updated**: 2024-06-04
**Test Suite Version**: 1.0
**Total Tests**: 80+
**Estimated Coverage**: 85%

