#!/usr/bin/env python3
"""Mechanically generate app TypeScript from the checked-in canonical export."""
from pathlib import Path
import hashlib, json

ROOT=Path(__file__).resolve().parents[1]; EXPORT=ROOT/"content"/"catechism.canonical.json"; OUTPUT=ROOT/"src"/"data"/"catechism.generated.ts"; MANIFEST=ROOT/"src"/"data"/"integrity.json"
def render(export=EXPORT):
    payload=json.loads(export.read_text()); assert payload["schemaVersion"]==1 and len(payload["questions"])==62
    header="// GENERATED FILE. DO NOT EDIT.\n// Source: content/catechism.canonical.json\n"
    text=header+f'export const sourceSha256={json.dumps(payload["sourceWorkbookSha256"])};\nexport const esvStandardNotice={json.dumps(payload["esvStandardNotice"],ensure_ascii=False)};\nexport const questions='+json.dumps(payload["questions"],ensure_ascii=False,indent=2)+' as const;\n'
    return text,payload
def main():
    text,payload=render(); OUTPUT.parent.mkdir(parents=True,exist_ok=True); OUTPUT.write_text(text,encoding="utf-8")
    manifest={"schemaVersion":1,"questionCount":len(payload["questions"]),"sourceWorkbookSha256":payload["sourceWorkbookSha256"],"canonicalExportSha256":hashlib.sha256(EXPORT.read_bytes()).hexdigest(),"generatedSha256":hashlib.sha256(text.encode()).hexdigest()}; MANIFEST.write_text(json.dumps(manifest,indent=2)+"\n"); print("Generated app data from checked-in canonical export")
if __name__=="__main__": main()
