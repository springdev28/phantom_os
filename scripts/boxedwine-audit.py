#!/usr/bin/env python3
"""Inspect the pinned public release without executing or distributing its guest files.

Explicit --download uses curl's verified HTTPS to a temporary directory. Never
accepts application files, exports to public/, or executes archive scripts.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import struct
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / 'tests/fixtures/boxedwine-artifacts.json').read_text())


def digest(data):
    return hashlib.sha256(data).hexdigest()


def audit(directory, download):
    directory.mkdir(parents=True, exist_ok=True)
    archive = directory / 'release.zip'
    if download and not archive.exists():
        subprocess.run(['curl', '--fail', '--location', '--silent', '--show-error', '--max-time', '180',
                        MANIFEST['releaseUrl'], '-o', str(archive)], check=True)
    data = archive.read_bytes()
    assert len(data) == MANIFEST['releaseBytes'] and digest(data) == MANIFEST['releaseSha256'], 'Release hash/size mismatch'
    with zipfile.ZipFile(io.BytesIO(data)) as release:
        # Only these two pinned engine files are extracted; no arbitrary ZIP paths.
        for item in MANIFEST['engine']:
            content = release.read(item['name'])
            assert len(content) == item['bytes'] and digest(content) == item['sha256'], item['name']
            (directory / item['name']).write_bytes(content)
        base = release.read('boxedwine.zip')
        root_info = next(item for item in MANIFEST['notAdopted'] if item['name'] == 'boxedwine.zip')
        assert len(base) == root_info['bytes'] and digest(base) == root_info['sha256']
        with zipfile.ZipFile(io.BytesIO(base)) as filesystem:
            entries = filesystem.infolist()
            notices = [entry.filename for entry in entries if any(token in entry.filename.lower()
                       for token in ['license', 'copying', 'copyright', '/doc/', '/src/', '/source/'])]
            notepad_path = 'home/username/.wine/drive_c/windows/notepad.exe'
            notepad = filesystem.read(notepad_path)
            offset = struct.unpack_from('<I', notepad, 0x3c)[0]
            pe = { 'bytes': len(notepad), 'sha256': digest(notepad), 'peOffset': offset,
                   'signature': notepad[offset:offset + 4].hex(), 'machine': hex(struct.unpack_from('<H', notepad, offset + 4)[0]),
                   'optionalMagic': hex(struct.unpack_from('<H', notepad, offset + 24)[0]),
                   'dosStubMarker': notepad[64:offset].rstrip(b'\0').decode('ascii') }
            assert pe['dosStubMarker'] == 'Wine placeholder DLL'
            inventory = [{'path': entry.filename, 'bytes': entry.file_size, 'compressedBytes': entry.compress_size} for entry in entries]
            result = { 'release': MANIFEST['release'], 'sourceCommit': MANIFEST['sourceCommit'],
                       'releaseSha256': digest(data), 'releaseContents': [{'path': x.filename, 'bytes': x.file_size} for x in release.infolist()],
                       'engine': MANIFEST['engine'], 'filesystem': { **root_info, 'version': filesystem.read('wineVersion.txt').decode(),
                           'revision': filesystem.read('version.txt').decode(), 'entries': len(entries),
                           'unpackedBytes': sum(entry.file_size for entry in entries), 'noticeOrSourcePaths': notices },
                       'notepad': pe, 'guestFilesExecuted': False, 'guestFilesDistributed': False,
                       'decision': 'blocked: component provenance/license/source inventory incomplete; no standalone PE Notepad fixture' }
            (directory / 'filesystem-inventory.json').write_text(json.dumps(inventory, indent=2) + '\n')
    (directory / 'audit.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path, help='Private temporary audit directory, never public/runtimes')
    parser.add_argument('--download', action='store_true', help='Download the exact public release if absent')
    args = parser.parse_args()
    target = args.directory.resolve()
    # Engine investigation files must stay outside the shipped app and fixtures.
    if target == ROOT or ROOT in target.parents:
        parser.error('Use a temporary directory outside this repository')
    audit(target, args.download)
