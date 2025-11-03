#!/bin/bash
# Check completion status of all checklists in a feature spec
# Usage: check-checklists.sh <spec-name>
#
# Example: check-checklists.sh 010-e2e-testing-suite
#
# Output: JSON with checklist status or plain text table

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Get spec name from argument
SPEC_NAME="${1:-}"

if [ -z "$SPEC_NAME" ]; then
  echo "Error: Spec name required" >&2
  echo "Usage: check-checklists.sh <spec-name>" >&2
  exit 1
fi

CHECKLISTS_DIR="$REPO_ROOT/specs/$SPEC_NAME/checklists"

# Check if checklists directory exists
if [ ! -d "$CHECKLISTS_DIR" ]; then
  echo "NO_CHECKLISTS"
  exit 0
fi

# Find all markdown files in checklists directory
CHECKLIST_FILES=$(find "$CHECKLISTS_DIR" -name "*.md" 2>/dev/null || true)

if [ -z "$CHECKLIST_FILES" ]; then
  echo "NO_CHECKLISTS"
  exit 0
fi

# Process each checklist file
RESULTS=""
ALL_COMPLETE=true

while IFS= read -r file; do
  if [ -z "$file" ]; then
    continue
  fi

  filename=$(basename "$file")
  total=$(grep -c "^- \[" "$file" 2>/dev/null || echo 0)
  completed=$(grep -c "^- \[[Xx]\]" "$file" 2>/dev/null || echo 0)
  incomplete=$((total - completed))

  if [ "$incomplete" -gt 0 ]; then
    status="FAIL"
    ALL_COMPLETE=false
  else
    status="PASS"
  fi

  RESULTS="${RESULTS}${filename}|${total}|${completed}|${incomplete}|${status}\n"
done <<< "$CHECKLIST_FILES"

# Output results
echo "| Checklist | Total | Completed | Incomplete | Status |"
echo "|-----------|-------|-----------|------------|--------|"

echo -e "$RESULTS" | while IFS='|' read -r filename total completed incomplete status; do
  if [ -n "$filename" ]; then
    status_symbol=""
    if [ "$status" = "PASS" ]; then
      status_symbol="✓ PASS"
    else
      status_symbol="✗ FAIL"
    fi
    printf "| %-9s | %-5s | %-9s | %-10s | %-6s |\n" "$filename" "$total" "$completed" "$incomplete" "$status_symbol"
  fi
done

# Exit with appropriate code
if [ "$ALL_COMPLETE" = true ]; then
  exit 0
else
  exit 1
fi
