#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
PORT="${PORT:-3000}"
export PORT

run() { /usr/bin/time -p "$@"; }
run test -f index.html
run python3 --version
# This is a dependency-free static project; no package installation is required.
run mkdir -p "$PROJECT_DIR/dist"
run cp "$PROJECT_DIR/index.html" "$PROJECT_DIR/dist/index.html"
run mkdir -p /home/runner/work/_temp/omgithub-web
export PROJECT_DIR
run python3 -c 'import json,os; p=os.path.realpath(os.environ["PROJECT_DIR"]); d=os.path.join(p,"dist"); out="/home/runner/work/_temp/omgithub-web/deployment-output.json"; open(out,"w").write(json.dumps({"project":p,"directory":d})+"\n")'
# Keep the server in the foreground so the controller can monitor its lifecycle.
run python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$PROJECT_DIR/dist"
