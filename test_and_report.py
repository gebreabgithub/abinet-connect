#!/usr/bin/env python3
"""
RUN AND REPORT TEST FAILURES
Executes all tests and shows detailed failure information
"""

import subprocess
import sys
import os
import re

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

def print_section(text):
    print(f"\n{BOLD}{YELLOW}{text}{RESET}\n")

def main():
    print_header("ABINET CONNECT - TEST EXECUTION & FAILURE REPORT")
    
    print(f"{BLUE}This will run the self-test and show you ALL failures...{RESET}\n")
    
    # Check if run_self_test.py exists
    if not os.path.exists("run_self_test.py"):
        print(f"{RED}✗ run_self_test.py not found!{RESET}")
        print(f"Make sure you're in the abinet-connect directory")
        sys.exit(1)
    
    # Run the self-test and capture output
    print_section("RUNNING TESTS...")
    print(f"{YELLOW}Executing run_self_test.py...{RESET}\n")
    
    try:
        result = subprocess.run(
            [sys.executable, "run_self_test.py"],
            capture_output=True,
            text=True,
            timeout=180
        )
        
        # Print the full output
        print("=" * 80)
        print("TEST OUTPUT:")
        print("=" * 80)
        print(result.stdout)
        
        if result.stderr:
            print("=" * 80)
            print("ERRORS (STDERR):")
            print("=" * 80)
            print(result.stderr)
        
        # Parse results
        output = result.stdout
        plain_output = re.sub(r"\x1b\[[0-9;]*m", "", output)
        lines = plain_output.split('\n')
        
        # Extract summary information
        print_header("PARSED RESULTS")
        
        passed = 0
        failed = 0
        
        for line in lines:
            if "Passed:" in line and "✓" in line:
                try:
                    passed = int(line.split(":")[-1].strip())
                except:
                    pass
            if "Failed:" in line and "✗" in line:
                try:
                    failed = int(line.split(":")[-1].strip())
                except:
                    pass
        
        print(f"{GREEN}✓ Passed: {passed}{RESET}")
        print(f"{RED}✗ Failed: {failed}{RESET}")
        
        total = passed + failed
        if total > 0:
            percentage = (passed / total) * 100
            print(f"{BOLD}Success Rate: {percentage:.1f}%{RESET}\n")
        
        # Extract failures if any
        if failed > 0:
            print_section("FAILURES DETECTED")
            
            in_failure_section = False
            for line in lines:
                if "✗ FAIL" in line:
                    print(f"{RED}{line}{RESET}")
                    in_failure_section = True
                elif in_failure_section and ("Reason:" in line or "Error:" in line or "Expected:" in line):
                    print(f"{RED}  {line}{RESET}")
                elif in_failure_section and line.strip() == "":
                    in_failure_section = False
        
        # Print status
        print_header("FINAL STATUS")
        
        if result.returncode != 0 and failed == 0:
            print(f"{RED}{BOLD}✗ TEST RUN FAILED BEFORE SUMMARY{RESET}\n")
            print(f"The self-test exited with code {result.returncode}. Review stderr above.\n")
            return result.returncode
        if failed == 0:
            print(f"{GREEN}{BOLD}✓ ALL TESTS PASSED! 🎉{RESET}\n")
            print(f"Your Abinet Connect application is working correctly!\n")
            return 0
        else:
            print(f"{RED}{BOLD}✗ {failed} TEST(S) FAILED{RESET}\n")
            print(f"Review the failures above and fix the issues.\n")
            return 1
        
    except subprocess.TimeoutExpired:
        print(f"{RED}✗ Tests timed out (exceeded 180 seconds){RESET}")
        return 1
    except Exception as e:
        print(f"{RED}✗ Error running tests: {e}{RESET}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
