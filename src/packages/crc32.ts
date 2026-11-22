const table = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
export class Crc32 {
  #value = 0xffffffff;
  update(bytes: Uint8Array): void {
    for (const byte of bytes) this.#value = table[(this.#value ^ byte) & 255]! ^ (this.#value >>> 8);
  }
  value(): number { return (this.#value ^ 0xffffffff) >>> 0; }
}
