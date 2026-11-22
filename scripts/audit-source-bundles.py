#!/usr/bin/env python3
"""Bounded, non-extracting audit of retained third-party source archives."""
import hashlib
import json
import stat
import tarfile
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
MAX_ITEMS = 20000
MAX_MEMBER = 8 * 1024 * 1024
MAX_TOTAL = 128 * 1024 * 1024
MAGICS = (b'MZ', b'\x7fELF', b'\0asm', b'\xfe\xed\xfa\xce',
          b'\xce\xfa\xed\xfe', b'\xfe\xed\xfa\xcf', b'\xcf\xfa\xed\xfe',
          b'\xca\xfe\xba\xbe', b'\xbe\xba\xfe\xca')
EXECUTABLE_SUFFIXES = {'.exe', '.dll', '.sys', '.com', '.wasm', '.rom', '.img', '.iso'}
# Reviewed text build/configuration files whose historical suffix resembles code.
TEXT_EXCEPTIONS = {
    ('mem-source.zip', 'TEST/XMS.SYS'): 'b7eff831620d9960f3cf345e1a12c4a748be8d7cc952c6a198e78a67866b0716',
    ('mem-source.zip', 'TEST/PLAIN.SYS'): 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    ('mem-source.zip', 'TEST/HMAMIN64.SYS'): '839fefb949373a2beedb0610a09a44f78712e5c8cc7e93a347f140d1453ddf42',
    ('mem-source.zip', 'TEST/HMAMIN15.SYS'): '9d875afda50846107862a8de0517e9a406da9d2129454ddf76452a9c23612b3d',
    ('zlib-1.2.13.tar.gz', 'zlib-1.2.13/contrib/minizip/make_vms.com'): '65736d9c4888f2373d3db0a13864d150c5040453f5bc2a5c8784379a7ea67590',
    ('zlib-1.2.13.tar.gz', 'zlib-1.2.13/make_vms.com'): '14ed54bdd391c1648cedfb69d8a73a26dcc7f1187d59b0f18d944b7665cec85b',
}


def inspect_member(archive, name, data):
    if data.startswith(MAGICS):
        raise ValueError(f'{archive}: executable signature in source member {name}')
    if PurePosixPath(name).suffix.lower() in EXECUTABLE_SUFFIXES:
        if TEXT_EXCEPTIONS.get((archive, name)) != hashlib.sha256(data).hexdigest():
            raise ValueError(f'{archive}: unaudited executable-like source member {name}')
    if data.startswith((b'PK\x03\x04', b'\x1f\x8b')):
        raise ValueError(f'{archive}: nested archive requires separate review: {name}')


def audit_archive(path):
    count = total = 0
    seen = set()

    def check(name, size, link):
        nonlocal count, total
        count += 1
        total += size
        p = PurePosixPath(name)
        if (not name or p.is_absolute() or '..' in p.parts or '\\' in name
                or ':' in name or name in seen or link):
            raise ValueError(f'{path.name}: unsafe source member {name}')
        seen.add(name)
        if count > MAX_ITEMS or size > MAX_MEMBER or total > MAX_TOTAL or size < 0:
            raise ValueError(f'{path.name}: source archive budget exceeded')

    if path.suffix == '.zip':
        with zipfile.ZipFile(path) as archive:
            for entry in archive.infolist():
                check(entry.filename, entry.file_size, stat.S_ISLNK(entry.external_attr >> 16))
                if not entry.is_dir():
                    with archive.open(entry) as stream:
                        data = stream.read(MAX_MEMBER + 1)
                    if len(data) != entry.file_size:
                        raise ValueError('Source member size mismatch')
                    inspect_member(path.name, entry.filename, data)
    else:
        with tarfile.open(path, 'r|gz') as archive:
            for entry in archive:
                check(entry.name, entry.size, not (entry.isdir() or entry.isfile()))
                if entry.isfile():
                    with archive.extractfile(entry) as stream:
                        data = stream.read(MAX_MEMBER + 1)
                    if len(data) != entry.size:
                        raise ValueError('Source member size mismatch')
                    inspect_member(path.name, entry.name, data)
    return {'archive': path.name, 'entries': count, 'unpackedBytes': total}


def main():
    manifest = json.loads((ROOT / 'vendor/dos/manifest.json').read_text())
    results = []
    for name, record in manifest['retained'].items():
        path = ROOT / name
        data = path.read_bytes()
        if len(data) != record['size'] or hashlib.sha256(data).hexdigest() != record['sha256']:
            raise ValueError(f'Retained source/fixture pin mismatch: {name}')
        if name.startswith('vendor/dos/') and name.endswith(('.zip', '.tar.gz', '.tgz')):
            results.append(audit_archive(path))
    print(json.dumps({'sourceArchiveAudit': 'passed', 'archives': results}, indent=2))


if __name__ == '__main__':
    main()
