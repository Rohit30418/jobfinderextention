"""Build an installable extension ZIP from a deliberate runtime allowlist."""
from pathlib import Path
import hashlib,json,zipfile
root=Path(__file__).resolve().parents[1]
version=json.loads((root/'manifest.json').read_text())['version']
out=root/'dist';out.mkdir(exist_ok=True)
archive=out/f'JobPilot-{version}.zip'
directories=['core','content','portals','onboarding','preferences','stage3','stage4','stage5','stage6','vendor']
files=[root/name for name in ['manifest.json','background.js','README.md','PRIVACY.md','RELEASE_NOTES.md']]
for directory in directories: files.extend(p for p in (root/directory).rglob('*') if p.is_file())
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as target:
 for path in sorted(files): target.write(path,path.relative_to(root))
with zipfile.ZipFile(archive) as target:
 assert target.testzip() is None
 assert 'vendor/pdf.worker.min.js' in target.namelist()
digest=hashlib.sha256(archive.read_bytes()).hexdigest()
(archive.with_suffix('.zip.sha256')).write_text(digest+'  '+archive.name+'\n')
print(f'{archive} ({archive.stat().st_size:,} bytes) SHA-256 {digest}')
