"""Synthetic archive tests; no unlicensed executable is retained."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('audit', Path(__file__).resolve().parents[1] / 'scripts/audit-source-bundles.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class SourceAuditTests(unittest.TestCase):
    def archive(self, name, data):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'source.zip'
            with zipfile.ZipFile(path, 'w') as z:
                z.writestr(name, data)
            return audit.audit_archive(path)

    def test_plain_source(self):
        self.assertEqual(self.archive('src/main.c', b'int main(){}')['entries'], 1)

    def test_removed_benchmark_name(self):
        with self.assertRaisesRegex(ValueError, 'unaudited executable-like'):
            self.archive('native/dhry2/bin/DOS4GW.EXE', b'inert regression data')

    def test_disguised_executable(self):
        for magic in audit.MAGICS:
            with self.subTest(magic=magic), self.assertRaisesRegex(ValueError, 'executable signature'):
                self.archive('src/hidden.dat', magic + b'inert regression data')

    def test_path_traversal(self):
        for name in ['../escape.c', '/absolute.c', 'C:/drive.c', 'a\\escape.c']:
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, 'unsafe'):
                self.archive(name, b'not extracted')

    def test_nested_archive(self):
        with self.assertRaisesRegex(ValueError, 'nested archive'):
            self.archive('nested.dat', b'PK\x03\x04inert')

    def test_budget(self):
        previous = audit.MAX_MEMBER
        try:
            audit.MAX_MEMBER = 3
            with self.assertRaisesRegex(ValueError, 'budget'):
                self.archive('large.c', b'four')
        finally:
            audit.MAX_MEMBER = previous

    def test_exception_not_general_suffix_allowlist(self):
        with self.assertRaisesRegex(ValueError, 'unaudited'):
            audit.inspect_member('mem-source.zip', 'TEST/XMS.SYS', b'changed')


if __name__ == '__main__':
    unittest.main()
