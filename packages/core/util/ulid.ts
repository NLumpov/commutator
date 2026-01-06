const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

let lastTime = -1;
let lastRandom: Uint8Array | null = null;

export function ulid(): string {
  const now = Date.now() & 0xffffffffffff;
  let random: Uint8Array;

  if (now === lastTime && lastRandom) {
    random = Uint8Array.from(lastRandom);
    for (let i = random.length - 1; i >= 0; i--) {
      const value = random[i];
      if (value !== undefined && value < 0xff) {
        random[i] = value + 1;
        break;
      }
      random[i] = 0;
    }
  } else {
    random = new Uint8Array(10);
    crypto.getRandomValues(random);
  }

  lastTime = now;
  lastRandom = random;

  let id = "";
  let time = now;
  for (let i = 0; i < 10; i++) {
    id = ENCODING[time & 31] + id;
    time >>>= 5;
  }

  let buffer = 0,
    bits = 0;
  for (const byte of random) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      id += ENCODING[(buffer >> bits) & 31];
      buffer &= (1 << bits) - 1;
    }
  }

  return id;
}
