export default function JsonViewer({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[520px] overflow-auto rounded-xl bg-gray-950 p-4 text-xs text-gray-100">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
