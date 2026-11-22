"""Reconstruct only audited, redistributable DOS fixtures. Never execute a guest."""
import argparse
import hashlib
import io
import json
from pathlib import Path
from zipfile import ZIP_STORED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / 'vendor/dos/manifest.json').read_text())
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--mem', type=Path)
parser.add_argument('--freecom', type=Path)
parser.add_argument('--verify', action='store_true')
args = parser.parse_args()

def digest(data):
    return hashlib.sha256(data).hexdigest()

def member(path, package, name):
    data = path.read_bytes()
    if digest(data) != MANIFEST['downloads'][package]:
        raise ValueError('Official package hash differs; do not silently adopt another binary.')
    with ZipFile(io.BytesIO(data)) as archive:
        return archive.read(name)

if not args.verify:
    if not args.mem or not args.freecom:
        parser.error('Provide both official package paths or --verify.')
    mem = member(args.mem, 'mem.zip', 'BIN/MEM.EXE')
    freecom = member(args.freecom, 'freecom-package.zip', 'BIN/COMMAND.COM')
    target = ROOT / 'tests/fixtures/dos'
    (target / 'MEM.EXE').write_bytes(mem)
    with ZipFile(target / 'FREECOM.ZIP', 'w', compression=ZIP_STORED) as archive:
        for name, contents in [
            ('APP/COMMAND.COM', freecom),
            ('APP/INPUT.TXT', b'PHANTOM local package resource.\r\nRead by FreeCOM TYPE, never by a substitute UI.\r\n'),
            ('APP/BELL.TXT', b'\x07\r\n'),
        ]:
            info = ZipInfo(name, (2026, 11, 21, 0, 0, 0))
            info.external_attr = 0o100644 << 16
            archive.writestr(info, contents)
for name in ['MEM.EXE', 'FREECOM.ZIP']:
    key = f'tests/fixtures/dos/{name}'
    data = (ROOT / key).read_bytes()
    assert len(data) == MANIFEST['retained'][key]['size']
    assert digest(data) == MANIFEST['retained'][key]['sha256'], 'Fixture hash differs from audited bytes.'
print('Both DOS fixture hashes match the audited manifest.')
