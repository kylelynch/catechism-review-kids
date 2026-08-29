#!/usr/bin/env python3
"""Verify export provenance, generated derivation, and local workbook fidelity."""
from pathlib import Path
import hashlib,json,sys
sys.path.insert(0,str(Path(__file__).parent))
from generate_data import EXPORT,MANIFEST,OUTPUT,render as render_app
from export_canonical import SOURCE,render as render_export

manifest=json.loads(MANIFEST.read_text()); expected_app,payload=render_app()
assert hashlib.sha256(EXPORT.read_bytes()).hexdigest()==manifest["canonicalExportSha256"],"Canonical export hash mismatch"
assert OUTPUT.read_text()==expected_app,"App data is not deterministically derived from canonical export"
assert hashlib.sha256(OUTPUT.read_bytes()).hexdigest()==manifest["generatedSha256"],"Generated app hash mismatch"
assert payload["sourceWorkbookSha256"]==manifest["sourceWorkbookSha256"] and manifest["questionCount"]==62
if SOURCE.exists():
    assert EXPORT.read_text()==render_export(SOURCE),"Canonical export differs from workbook (normalized byte-for-byte check)"
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==manifest["sourceWorkbookSha256"],"Recorded workbook hash mismatch"
    print("Export provenance, workbook fidelity, and app derivation checks passed")
else: print("Export provenance and app derivation checks passed; private workbook unavailable")
