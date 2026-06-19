// Logging helpers — a lighter take on the banners from the old common.sh.

const WIDTH = 44;

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Print a single timestamped line, mirroring `print_c` from common.sh. */
export function print(message) {
  console.log(`[[${stamp()}]][[${message}]]`);
}

/** Print a centered banner, mirroring `header_c` from common.sh. */
export function header(title) {
  let label = title;
  if (label.length % 2 === 1) label += ' ';
  const trim = Math.floor((WIDTH - label.length) / 2);
  const pad = ' '.repeat(Math.max(trim, 0));
  print(`==>${pad}${label}${pad}<==`);
}

export function separator() {
  print('='.repeat(WIDTH + 6));
}

/** Report elapsed time, mirroring `statistic_c`. */
export function statistic(startMs) {
  header('statistic');
  const seconds = Math.round((Date.now() - startMs) / 1000);
  print(`${Math.floor(seconds / 60)} minutes and ${seconds % 60} seconds elapsed.`);
}
