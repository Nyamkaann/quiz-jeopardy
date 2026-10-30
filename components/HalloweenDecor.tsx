/**
 * Purely decorative Halloween layer: bats crossing the moon, cobwebs in the top
 * corners and fog along the bottom. Fixed behind every page, ignores clicks.
 */

const BAT_PATH =
  "M32 12c-1.6-3.4-3.4-5.4-3.4-5.4s.2 3.4-.6 5.2c-3.8-2.2-8.8-3-13.6-1.2 2.8 1 4.6 3.6 4.8 6.6-4-1.8-9-1.6-12.8.4 4 1 6.8 4.6 7.6 8.4 3.8-2.6 8.8-3.6 12.8-1.8 2.2 1 4 2.8 5.2 4.6 1.2-1.8 3-3.6 5.2-4.6 4-1.8 9-.8 12.8 1.8.8-3.8 3.6-7.4 7.6-8.4-3.8-2-8.8-2.2-12.8-.4.2-3 2-5.6 4.8-6.6-4.8-1.8-9.8-1-13.6 1.2-.8-1.8-.6-5.2-.6-5.2s-1.8 2-3.4 5.4z";

// top (vh), size (px), flight duration (s), start delay (s)
const BATS = [
  { top: 9, size: 46, dur: 26, delay: 0 },
  { top: 18, size: 30, dur: 34, delay: 7 },
  { top: 5, size: 22, dur: 41, delay: 15 },
  { top: 26, size: 36, dur: 30, delay: 21 },
];

function Cobweb({ flip }: { flip?: boolean }) {
  return (
    <svg
      className="cobweb"
      viewBox="0 0 200 200"
      style={flip ? { right: 0, transform: "scaleX(-1)" } : { left: 0 }}
      aria-hidden
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.1">
        {[0, 18, 36, 54, 72, 90].map((a) => {
          const r = (a * Math.PI) / 180;
          return <line key={a} x1="0" y1="0" x2={200 * Math.cos(r)} y2={200 * Math.sin(r)} />;
        })}
        {[38, 72, 108, 146, 186].map((d) => (
          <path
            key={d}
            d={[0, 18, 36, 54, 72, 90]
              .map((a, i) => {
                const r = (a * Math.PI) / 180;
                const x = d * Math.cos(r);
                const y = d * Math.sin(r);
                return `${i === 0 ? "M" : "Q"}${i === 0 ? "" : `${d * 0.86 * Math.cos(r - 0.157)} ${d * 0.86 * Math.sin(r - 0.157)} `}${x} ${y}`;
              })
              .join(" ")}
          />
        ))}
      </g>
      <line x1="150" y1="0" x2="150" y2="96" stroke="currentColor" strokeWidth="0.8" />
      <g transform="translate(150 104)" fill="currentColor">
        <ellipse rx="7" ry="8.5" />
        <circle cy="-9" r="4.5" />
        {[-1, 1].flatMap((s) =>
          [-6, -2, 2, 6].map((y) => (
            <path key={`${s}${y}`} d={`M0 ${y} q${s * 9} ${-6 + y * 0.4} ${s * 15} ${y * 0.9 + 4}`} stroke="currentColor" strokeWidth="1.4" fill="none" />
          )),
        )}
      </g>
    </svg>
  );
}

export default function HalloweenDecor() {
  return (
    <div className="halloween-decor" aria-hidden>
      <Cobweb />
      <Cobweb flip />
      {BATS.map((b, i) => (
        <div
          key={i}
          className="bat"
          style={{ top: `${b.top}vh`, width: b.size, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }}
        >
          <svg viewBox="0 0 64 36" className="bat-wings" style={{ animationDuration: `${0.28 + i * 0.05}s` }}>
            <path d={BAT_PATH} fill="currentColor" />
          </svg>
        </div>
      ))}
      <div className="fog" />
      <div className="fog fog-2" />
    </div>
  );
}
