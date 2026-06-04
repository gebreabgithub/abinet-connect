#!/usr/bin/env python3
"""
COMPREHENSIVE SELF-TEST EXECUTION
Tests the entire Abinet Connect application automatically
"""

import subprocess
import time
import sys
import json
import requests
from datetime import datetime

# Colors
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
BOLD = '\033[1m'
RESET = '\033[0m'

def print_header(text):
    print(f"\n{BOLD}{BLUE}{'='*80}")
    print(f"{text}")
    print(f"{'='*80}{RESET}\n")

def print_success(text):
    print(f"{GREEN}✓ {text}{RESET}")

def print_fail(text):
    print(f"{RED}✗ {text}{RESET}")

def print_info(text):
    print(f"{BLUE}ℹ {text}{RESET}")

def print_step(num, text):
    print(f"{BOLD}{YELLOW}STEP {num}: {text}{RESET}\n")

class SelfTest:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.results = []
        self.backend_process = None
        
    def start_backend(self):
        """Start the backend server"""
        print_step(1, "Starting Backend Server")
        
        try:
            print_info("Starting backend on http://127.0.0.1:8080...")
            self.backend_process = subprocess.Popen(
                ["python3", "backend/app.py", "--port", "8080"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=".",
            )
            time.sleep(3)  # Wait for backend to start
            print_success("Backend started with PID: " + str(self.backend_process.pid))
            return True
        except Exception as e:
            print_fail(f"Failed to start backend: {e}")
            return False
    
    def test_health(self):
        """Test health endpoint"""
        print_step(2, "Testing Health & Bootstrap")
        
        try:
            response = requests.get("http://127.0.0.1:8080/api/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "ok":
                    print_success("Health check passed")
                    self.passed += 1
                    return True
        except Exception as e:
            print_fail(f"Health check failed: {e}")
            self.failed += 1
        return False
    
    def test_bootstrap(self):
        """Test bootstrap endpoint"""
        try:
            response = requests.get("http://127.0.0.1:8080/api/bootstrap", timeout=5)
            if response.status_code == 200:
                data = response.json()
                required = ["users", "workers", "jobs", "stats"]
                if all(k in data for k in required):
                    print_success(f"Bootstrap data loaded ({len(data)} keys)")
                    print(f"  - Users: {data.get('stats', {}).get('users', 0)}")
                    print(f"  - Workers: {data.get('stats', {}).get('workers', 0)}")
                    print(f"  - Jobs: {data.get('stats', {}).get('openJobs', 0)}")
                    self.passed += 1
                    return True
        except Exception as e:
            print_fail(f"Bootstrap failed: {e}")
            self.failed += 1
        return False
    
    def test_registration(self):
        """Test user registration"""
        print_step(3, "Testing Registration (All Roles)")
        
        test_users = [
            {
                "name": "Test Worker 1",
                "phone": "+251911000111",
                "username": "worker.test1",
                "password": "test123456",
                "role": "Worker",
                "identityDocumentType": "National ID",
                "identityDocumentNumber": "ID-TEST-001",
            },
            {
                "name": "Test Employer 1",
                "phone": "+251911200111",
                "username": "employer.test1",
                "password": "test123456",
                "role": "Employer",
                "identityDocumentType": "Business Registration",
                "identityDocumentNumber": "BRN-TEST-001",
            },
            {
                "name": "Test Broker 1",
                "phone": "+251911300111",
                "username": "broker.test1",
                "password": "test123456",
                "role": "Broker",
                "identityDocumentType": "National ID",
                "identityDocumentNumber": "ID-BROKER-001",
            },
        ]
        
        for user in test_users:
            try:
                response = requests.post(
                    "http://127.0.0.1:8080/api/users/register",
                    json=user,
                    timeout=5
                )
                if response.status_code == 201:
                    data = response.json()
                    print_success(f"Registered {user['role']}: {user['username']}")
                    self.passed += 1
                else:
                    print_fail(f"Registration failed for {user['username']}: {response.status_code}")
                    self.failed += 1
            except Exception as e:
                print_fail(f"Registration error for {user['username']}: {e}")
                self.failed += 1
    
    def test_login(self):
        """Test authentication"""
        print_step(4, "Testing Authentication")
        
        test_logins = [
            ("worker.test1", "test123456", "Worker"),
            ("employer.test1", "test123456", "Employer"),
            ("broker.test1", "test123456", "Broker"),
        ]
        
        for username, password, role in test_logins:
            try:
                response = requests.post(
                    "http://127.0.0.1:8080/api/auth/login",
                    json={"username": username, "password": password},
                    timeout=5
                )
                if response.status_code == 200:
                    data = response.json()
                    if "token" in data and "user" in data:
                        print_success(f"Login successful: {username} ({role})")
                        self.passed += 1
                    else:
                        print_fail(f"Login missing token/user: {username}")
                        self.failed += 1
                else:
                    print_fail(f"Login failed for {username}: {response.status_code}")
                    self.failed += 1
            except Exception as e:
                print_fail(f"Login error for {username}: {e}")
                self.failed += 1
    
    def test_job_posting(self):
        """Test job posting"""
        print_step(5, "Testing Job Posting")
        
        # First login to get token
        try:
            login_response = requests.post(
                "http://127.0.0.1:8080/api/auth/login",
                json={"username": "employer.test1", "password": "test123456"},
                timeout=5
            )
            
            if login_response.status_code != 200:
                print_fail("Cannot login for job posting")
                self.failed += 1
                return
            
            token = login_response.json().get("token")
            
            # Post a job
            job_data = {
                "title": "Test Chef Position",
                "employer": "Test Restaurant",
                "location": "Addis Ababa",
                "category": "Hospitality",
                "skills": "Cooking, Leadership",
                "salary": "10000",
                "currency": "ETB",
            }
            
            response = requests.post(
                "http://127.0.0.1:8080/api/jobs",
                json=job_data,
                headers={"X-Auth-Token": token},
                timeout=5
            )
            
            if response.status_code == 201:
                data = response.json()
                print_success(f"Job posted: {job_data['title']}")
                print(f"  - Status: {data.get('status')}")
                print(f"  - Location: {data.get('location')}")
                self.passed += 1
            else:
                print_fail(f"Job posting failed: {response.status_code}")
                self.failed += 1
                
        except Exception as e:
            print_fail(f"Job posting error: {e}")
            self.failed += 1
    
    def test_job_applications(self):
        """Test job applications"""
        print_step(6, "Testing Job Applications")
        
        try:
            # Login as worker
            login_response = requests.post(
                "http://127.0.0.1:8080/api/auth/login",
                json={"username": "worker.test1", "password": "test123456"},
                timeout=5
            )
            
            if login_response.status_code != 200:
                print_fail("Cannot login as worker")
                self.failed += 1
                return
            
            token = login_response.json().get("token")
            
            # Get available jobs
            jobs_response = requests.get(
                "http://127.0.0.1:8080/api/jobs",
                headers={"X-Auth-Token": token},
                timeout=5
            )
            
            if jobs_response.status_code == 200:
                jobs = jobs_response.json()
                if len(jobs) > 0:
                    job_id = jobs[0].get("id")
                    
                    # Apply for job
                    app_data = {
                        "jobId": job_id,
                        "message": "I am interested in this position",
                    }
                    
                    app_response = requests.post(
                        "http://127.0.0.1:8080/api/applications",
                        json=app_data,
                        headers={"X-Auth-Token": token},
                        timeout=5
                    )
                    
                    if app_response.status_code == 201:
                        print_success(f"Application submitted for job: {job_id[:10]}...")
                        self.passed += 1
                    else:
                        print_fail(f"Application failed: {app_response.status_code}")
                        self.failed += 1
                else:
                    print_info("No jobs available to apply")
            else:
                print_fail(f"Cannot fetch jobs: {jobs_response.status_code}")
                self.failed += 1
                
        except Exception as e:
            print_fail(f"Job application error: {e}")
            self.failed += 1
    
    def test_worker_listing(self):
        """Test worker listing and filtering"""
        print_step(7, "Testing Worker Listing & Filtering")
        
        try:
            response = requests.get(
                "http://127.0.0.1:8080/api/workers",
                timeout=5
            )
            
            if response.status_code == 200:
                workers = response.json()
                print_success(f"Workers retrieved: {len(workers)} total")
                self.passed += 1
                
                # Test filtering
                filter_response = requests.get(
                    "http://127.0.0.1:8080/api/workers?verified=false",
                    timeout=5
                )
                
                if filter_response.status_code == 200:
                    unverified = filter_response.json()
                    print_success(f"Unverified workers: {len(unverified)}")
                    self.passed += 1
                    
            else:
                print_fail(f"Worker listing failed: {response.status_code}")
                self.failed += 1
                
        except Exception as e:
            print_fail(f"Worker listing error: {e}")
            self.failed += 1
    
    def test_error_handling(self):
        """Test error handling"""
        print_step(8, "Testing Error Handling")
        
        # Test duplicate registration
        try:
            dup_data = {
                "name": "Duplicate Test",
                "phone": "+251911000111",  # Same as worker.test1
                "username": "different.user",
                "password": "test123456",
                "role": "Worker",
            }
            
            response = requests.post(
                "http://127.0.0.1:8080/api/users/register",
                json=dup_data,
                timeout=5
            )
            
            if response.status_code == 409:
                print_success("Duplicate phone detection working (409 Conflict)")
                self.passed += 1
            else:
                print_fail(f"Duplicate detection failed: {response.status_code}")
                self.failed += 1
                
        except Exception as e:
            print_fail(f"Duplicate phone test error: {e}")
            self.failed += 1
        
        # Test invalid login
        try:
            response = requests.post(
                "http://127.0.0.1:8080/api/auth/login",
                json={"username": "worker.test1", "password": "wrongpassword"},
                timeout=5
            )
            
            if response.status_code == 401:
                print_success("Invalid password rejection working (401 Unauthorized)")
                self.passed += 1
            else:
                print_fail(f"Invalid password check failed: {response.status_code}")
                self.failed += 1
                
        except Exception as e:
            print_fail(f"Invalid login test error: {e}")
            self.failed += 1
    
    def test_data_integrity(self):
        """Test data integrity"""
        print_step(9, "Testing Data Integrity")
        
        try:
            # Test that data.json is valid
            with open("backend/data.json", "r") as f:
                data = json.load(f)
            
            print_success("data.json is valid JSON")
            
            # Check required sections
            required = ["users", "workers", "jobs"]
            if all(k in data for k in required):
                print_success(f"All required sections present ({len(required)} sections)")
                self.passed += 2
            else:
                print_fail("Missing required data sections")
                self.failed += 1
                
        except json.JSONDecodeError as e:
            print_fail(f"data.json JSON error: {e}")
            self.failed += 1
        except Exception as e:
            print_fail(f"Data integrity error: {e}")
            self.failed += 1
    
    def test_api_endpoints(self):
        """Test all major API endpoints"""
        print_step(10, "Testing API Endpoints")
        
        endpoints = [
            ("GET", "/api/health", None, 200),
            ("GET", "/api/bootstrap", None, 200),
            ("GET", "/api/jobs", None, 200),
            ("GET", "/api/workers", None, 200),
            ("GET", "/api/job-categories", None, 200),
        ]
        
        for method, endpoint, data, expected_status in endpoints:
            try:
                if method == "GET":
                    response = requests.get(
                        f"http://127.0.0.1:8080{endpoint}",
                        timeout=5
                    )
                
                if response.status_code == expected_status:
                    print_success(f"{method} {endpoint}")
                    self.passed += 1
                else:
                    print_fail(f"{method} {endpoint}: Expected {expected_status}, got {response.status_code}")
                    self.failed += 1
                    
            except Exception as e:
                print_fail(f"{method} {endpoint}: {e}")
                self.failed += 1
    
    def print_summary(self):
        """Print test summary"""
        print_header("TEST SUMMARY")
        
        total = self.passed + self.failed
        percentage = (self.passed / total * 100) if total > 0 else 0
        
        print(f"{GREEN}✓ Passed: {self.passed}{RESET}")
        print(f"{RED}✗ Failed: {self.failed}{RESET}")
        print(f"{BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{RESET}")
        print(f"{BOLD}Total: {total}{RESET}")
        print(f"{BOLD}Success Rate: {percentage:.1f}%{RESET}\n")
        
        if self.failed == 0:
            print(f"{GREEN}{BOLD}✓ ALL TESTS PASSED! 🎉{RESET}\n")
            return True
        else:
            print(f"{RED}{BOLD}✗ Some tests failed. Review errors above.{RESET}\n")
            return False
    
    def cleanup(self):
        """Stop backend process"""
        print_step(11, "Cleanup")
        
        if self.backend_process:
            print_info("Stopping backend...")
            self.backend_process.terminate()
            time.sleep(1)
            if self.backend_process.poll() is None:
                self.backend_process.kill()
            print_success("Backend stopped")
    
    def run_all_tests(self):
        """Run all tests"""
        print(f"\n{BOLD}{BLUE}")
        print("╔════════════════════════════════════════════════════════════════════════════╗")
        print("║         ABINET CONNECT - COMPLETE SELF-TEST EXECUTION                     ║")
        print("╚════════════════════════════════════════════════════════════════════════════╝")
        print(f"{RESET}\n")
        
        print_info(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        
        try:
            # Start backend
            if not self.start_backend():
                print_fail("Cannot proceed without backend")
                return False
            
            # Run tests
            self.test_health()
            self.test_bootstrap()
            self.test_registration()
            self.test_login()
            self.test_job_posting()
            self.test_job_applications()
            self.test_worker_listing()
            self.test_error_handling()
            self.test_data_integrity()
            self.test_api_endpoints()
            
            # Print summary
            success = self.print_summary()
            
            return success
            
        except Exception as e:
            print_fail(f"Unexpected error: {e}")
            return False
        finally:
            self.cleanup()

if __name__ == "__main__":
    tester = SelfTest()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)
