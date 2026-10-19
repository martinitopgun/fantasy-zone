"""Turn saved Firecrawl scrape results into fixture files the engine can read offline.

Usage: python3 -I tools/import-fixtures.py <scrape-result.json>...
"""
import json, re, sys, pathlib

out = pathlib.Path(__file__).resolve().parent.parent / "fixtures"
for path in sys.argv[1:]:
    j = json.load(open(path))
    url = j["metadata"]["sourceURL"]
    name = re.sub(r"[^a-zA-Z0-9]+", "_", re.sub(r"^https?://", "", url)).strip("_") + ".json"
    data = json.loads(j["rawHtml"])
    (out / name).write_text(json.dumps(data, separators=(",", ":")))
    print(name)
