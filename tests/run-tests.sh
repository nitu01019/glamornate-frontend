#!/bin/bash

# Glamornate Test Runner Script
# This script runs all tests and generates reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Glamornate Test Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to run unit tests
run_unit_tests() {
    echo -e "${YELLOW}Running Unit Tests...${NC}"
    cd "$PROJECT_ROOT"

    if npx vitest run --reporter=verbose; then
        echo -e "${GREEN}Unit tests passed${NC}"
    else
        echo -e "${RED}Unit tests failed${NC}"
        return 1
    fi
}

# Function to run unit tests with coverage
run_unit_tests_coverage() {
    echo -e "${YELLOW}Running Unit Tests with Coverage...${NC}"
    cd "$PROJECT_ROOT"

    if npx vitest run --coverage; then
        echo -e "${GREEN}Unit tests with coverage complete${NC}"
        echo -e "${BLUE}Coverage report: $PROJECT_ROOT/coverage/index.html${NC}"
    else
        echo -e "${RED}Unit tests with coverage failed${NC}"
        return 1
    fi
}

# Function to run E2E tests
run_e2e_tests() {
    echo -e "${YELLOW}Running E2E Tests...${NC}"
    cd "$PROJECT_ROOT"

    if npx playwright test; then
        echo -e "${GREEN}E2E tests passed${NC}"
        echo -e "${BLUE}E2E report: $SCRIPT_DIR/playwright-report/index.html${NC}"
    else
        echo -e "${RED}E2E tests failed${NC}"
        return 1
    fi
}

# Function to run E2E tests headed
run_e2e_tests_headed() {
    echo -e "${YELLOW}Running E2E Tests (Headed)...${NC}"
    cd "$PROJECT_ROOT"

    if npx playwright test --headed; then
        echo -e "${GREEN}E2E tests passed${NC}"
    else
        echo -e "${RED}E2E tests failed${NC}"
        return 1
    fi
}

# Function to run E2E tests in debug mode
run_e2e_tests_debug() {
    echo -e "${YELLOW}Running E2E Tests (Debug Mode)...${NC}"
    cd "$PROJECT_ROOT"

    if npx playwright test --debug; then
        echo -e "${GREEN}E2E tests passed${NC}"
    else
        echo -e "${RED}E2E tests failed${NC}"
        return 1
    fi
}

# Function to run Vitest in watch mode
run_watch() {
    echo -e "${YELLOW}Running Vitest in Watch Mode...${NC}"
    cd "$PROJECT_ROOT"
    npx vitest
}

# Function to clean up
cleanup() {
    echo -e "${YELLOW}Cleaning up test artifacts...${NC}"
    cd "$SCRIPT_DIR"
    rm -rf coverage playwright-report test-results
    cd "$PROJECT_ROOT"
    rm -rf coverage
    echo -e "${GREEN}Cleanup complete${NC}"
}

# Function to show help
show_help() {
    echo "Usage: ./run-tests.sh [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  unit           Run unit tests only"
    echo "  coverage       Run unit tests with coverage report"
    echo "  e2e            Run E2E tests"
    echo "  e2e-headed     Run E2E tests in headed mode"
    echo "  e2e-debug      Run E2E tests in debug mode"
    echo "  watch          Run Vitest in watch mode"
    echo "  all            Run all tests (unit + e2e)"
    echo "  cleanup        Clean up test artifacts"
    echo "  help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./run-tests.sh unit"
    echo "  ./run-tests.sh coverage"
    echo "  ./run-tests.sh all"
}

# Main script logic
case "${1:-}" in
    unit)
        run_unit_tests
        ;;
    coverage)
        run_unit_tests_coverage
        ;;
    e2e)
        run_e2e_tests
        ;;
    e2e-headed)
        run_e2e_tests_headed
        ;;
    e2e-debug)
        run_e2e_tests_debug
        ;;
    watch)
        run_watch
        ;;
    all)
        run_unit_tests
        run_e2e_tests
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}   ALL TESTS PASSED!${NC}"
        echo -e "${GREEN}========================================${NC}"
        ;;
    cleanup)
        cleanup
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
