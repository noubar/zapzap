/* global __dirname, Buffer */
const fs = require('node:fs');
const path = require('node:path');

const SAMPLE_RATE = 22_050;
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');

const sounds = {
  go: { duration: 0.07, notes: [[1_250, 0, 0.07]], wave: 'square', volume: 0.22 },
  success: { duration: 0.16, notes: [[740, 0, 0.08], [1_110, 0.08, 0.08]], wave: 'sine', volume: 0.25 },
  error: { duration: 0.19, notes: [[185, 0, 0.19]], wave: 'square', volume: 0.18 },
  timeout: { duration: 0.25, notes: [[440, 0, 0.11], [280, 0.11, 0.14]], wave: 'triangle', volume: 0.23 },
  wrong: { duration: 0.18, notes: [[310, 0, 0.08], [220, 0.08, 0.1]], wave: 'square', volume: 0.17 },
  roundWin: { duration: 0.24, notes: [[660, 0, 0.08], [880, 0.08, 0.08], [1_100, 0.16, 0.08]], wave: 'sine', volume: 0.24 },
  matchWin: { duration: 0.48, notes: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1_047, 0.3, 0.18]], wave: 'sine', volume: 0.25 },
  draw: { duration: 0.22, notes: [[520, 0, 0.1], [520, 0.12, 0.1]], wave: 'triangle', volume: 0.21 },
  menu: { duration: 0.05, notes: [[900, 0, 0.05]], wave: 'sine', volume: 0.16 },
};

function oscillator(kind, phase) {
  if (kind === 'square') return Math.sin(phase) >= 0 ? 1 : -1;
  if (kind === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(phase));
  return Math.sin(phase);
}

function writeWav(name, definition) {
  const sampleCount = Math.floor(SAMPLE_RATE * definition.duration);
  const dataLength = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataLength);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE;
    const note = definition.notes.find((entry) => time >= entry[1] && time < entry[1] + entry[2]);
    let sample = 0;
    if (note) {
      const noteTime = time - note[1];
      const edge = Math.min(1, noteTime / 0.006, (note[2] - noteTime) / 0.012);
      sample = oscillator(definition.wave, 2 * Math.PI * note[0] * noteTime) * definition.volume * Math.max(0, edge);
    }
    buffer.writeInt16LE(Math.round(sample * 32_767), 44 + index * 2);
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, `${name}.wav`), buffer);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
Object.entries(sounds).forEach(([name, definition]) => writeWav(name, definition));

