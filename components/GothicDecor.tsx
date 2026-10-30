/**
 * Purely decorative "Corpse Bride" layer: curly gothic trees in the bottom
 * corners, glowing blue butterflies drifting across, and cold mist.
 * Fixed behind every page, ignores clicks.
 */

// trunk → branches → twigs, each ending in a Burton-style curl; drawn thick to thin
const TREE: { d: string; w: number }[] = [
  { d: "M150 500 C 150 430, 138 382, 150 330 C 162 282, 140 240, 150 196", w: 20 },
  { d: "M150 478 C 120 488, 96 486, 78 500 M150 478 C 182 486, 206 490, 228 500", w: 9 },
  { d: "M150 330 C 110 300, 72 300, 56 262 C 45 232, 76 214, 89 236 C 99 252, 80 263, 72 250", w: 9 },
  { d: "M150 272 C 190 242, 234 246, 250 206 C 262 172, 230 160, 220 181 C 213 196, 232 201, 236 189", w: 8 },
  { d: "M150 200 C 140 160, 114 140, 120 104 C 125 74, 159 75, 157 100 C 155 118, 136 116, 138 102", w: 7 },
  { d: "M150 222 C 176 192, 200 172, 205 140 C 210 112, 184 104, 182 126 C 181 136, 192 138, 194 130", w: 5 },
  { d: "M96 292 C 86 322, 60 332, 40 320 C 24 310, 35 290, 49 299", w: 4 },
  { d: "M232 226 C 252 238, 270 262, 262 284 C 256 298, 238 292, 244 280", w: 4 },
  { d: "M128 150 C 104 146, 86 128, 92 110 C 96 98, 110 102, 106 112", w: 3 },
];

function CurlyTree({ flip }: { flip?: boolean }) {
  return (
    <svg
      className="curly-tree"
      viewBox="0 0 300 500"
      style={flip ? { right: "-2vw", transform: "scaleX(-1)" } : { left: "-2vw" }}
      aria-hidden
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        {TREE.map((b, i) => (
          <path key={i} d={b.d} strokeWidth={b.w} />
        ))}
      </g>
    </svg>
  );
}

// top (vh), size (px), drift duration (s), start delay (s)
const BUTTERFLIES = [
  { top: 72, size: 26, dur: 30, delay: 0 },
  { top: 58, size: 18, dur: 38, delay: 6 },
  { top: 84, size: 22, dur: 26, delay: 13 },
  { top: 64, size: 30, dur: 34, delay: 19 },
  { top: 48, size: 16, dur: 42, delay: 27 },
];

function Butterfly({ beat }: { beat: number }) {
  return (
    <svg viewBox="0 0 40 30" className="butterfly-wings" style={{ animationDuration: `${beat}s` }}>
      <g fill="currentColor">
        <path d="M20 15 C 14 2, 2 0, 3 9 C 4 15, 12 16, 20 15 Z" opacity="0.95" />
        <path d="M20 15 C 12 17, 5 22, 9 27 C 13 30, 18 23, 20 15 Z" opacity="0.75" />
        <path d="M20 15 C 26 2, 38 0, 37 9 C 36 15, 28 16, 20 15 Z" opacity="0.95" />
        <path d="M20 15 C 28 17, 35 22, 31 27 C 27 30, 22 23, 20 15 Z" opacity="0.75" />
      </g>
      <ellipse cx="20" cy="15" rx="1.2" ry="6" fill="#0b1a22" />
    </svg>
  );
}

export default function GothicDecor() {
  return (
    <div className="gothic-decor" aria-hidden>
      <div className="mist" />
      <div className="mist mist-2" />
      <CurlyTree />
      <CurlyTree flip />
      {BUTTERFLIES.map((b, i) => (
        <div
          key={i}
          className="butterfly"
          style={{ top: `${b.top}vh`, width: b.size, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }}
        >
          <Butterfly beat={0.22 + i * 0.04} />
        </div>
      ))}
    </div>
  );
}
