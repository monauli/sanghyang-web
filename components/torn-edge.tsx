/** Tepi robekan kertas besar & tegas — dipakai di transisi section gelap
 *  (Reservasi, Footer), gaya referensi Pinterest. `flip` membalik untuk tepi
 *  bawah. */
const JAGGED_PATH =
  'M0,70L180,20L360,62L540,15L720,66L900,10L1080,60L1260,22L1440,55L1440,0L0,0Z';

export function TornEdge({
  flip = false,
  className = '',
}: {
  flip?: boolean;
  className?: string;
}) {
  return (
    <svg
      className={`pointer-events-none absolute inset-x-0 h-12 w-full sm:h-20 ${flip ? 'bottom-0 rotate-180' : 'top-0'} ${className}`}
      viewBox="0 0 1440 90"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path fill="currentColor" d={JAGGED_PATH} />
    </svg>
  );
}
