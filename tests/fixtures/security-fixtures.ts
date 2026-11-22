import { packageZip, textBytes } from './package-fixtures.ts';
import { gptFixture, peFixture } from './probe-fixtures.ts';

const corruptPe = peFixture(); new DataView(corruptPe.buffer).setUint32(60, 0xfffffff0, true);
const corruptGpt = gptFixture(4096); new DataView(corruptGpt.buffer).setBigUint64(4096 + 72, 0xffffffffffffffffn, true);
export const hostileHeaders = [
  { name: 'PRIVATE_CORRUPT.EXE', bytes: corruptPe, diagnostic: 'INVALID_OFFSET' },
  { name: 'PRIVATE_ODD_DISK.IMG', bytes: corruptGpt, diagnostic: 'GPT' },
];
export const hostileArchives = [
  { id: 'corrupt', bytes: packageZip([{ path: 'A.TXT', bytes: textBytes('inert') }]).slice(0, -9), message: 'ZIP is corrupt' },
  { id: 'traversal', bytes: packageZip([{ path: '../../HOST.TXT', bytes: textBytes('PRIVATE_ARCHIVE_CONTENT') }]), message: 'unsafe file name or path' },
  { id: 'absolute', bytes: packageZip([{ path: 'C:/HOST.TXT', bytes: textBytes('inert') }]), message: 'unsafe file name or path' },
  { id: 'symlink', bytes: packageZip([{ path: 'LINK', bytes: textBytes('/etc/passwd'), attributes: 0xa1ff0000 }]), message: 'unsupported feature' },
  { id: 'declared-size', bytes: packageZip([{ path: 'HUGE', bytes: textBytes('small'), declaredSize: 64 * 1024 * 1024 + 1 }]), message: 'package exceeds a limit' },
  { id: 'ratio', bytes: packageZip([{ path: 'BOMB', bytes: new Uint8Array(1024 * 1024) }]), message: '100:1 expansion limit' },
  { id: 'lying-size', bytes: packageZip([{ path: 'BOMB', bytes: new Uint8Array(1024 * 1024), declaredSize: 1 }]), message: 'package exceeds a limit' },
  { id: 'item-count', bytes: packageZip(Array.from({ length: 2049 }, (_, i) => ({ path: `F${i}`, bytes: new Uint8Array(), method: 0 }))), message: 'package exceeds a limit' },
];
