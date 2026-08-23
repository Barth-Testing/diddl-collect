export function SelectBasis({
  value,
  onChange,
  optionen,
}: {
  value: string;
  onChange: (v: string) => void;
  optionen: string[][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-full border border-cream-300 bg-white px-3 py-2 text-sm font-bold text-ink-800 outline-none focus:border-candy-400 focus:ring-2 focus:ring-candy-200"
    >
      {optionen.map(([val, label]) => (
        <option key={val} value={val}>
          {label}
        </option>
      ))}
    </select>
  );
}
