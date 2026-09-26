function LanguageSelector({ value, onChange }) {
  return (
    <div className="flex flex-col items-center w-full mt-4" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginTop: '1rem' }}>
      <p className="text-sm text-gray-500 mb-2 text-center font-medium" style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', textAlign: 'center', fontWeight: 500, margin: '0 0 0.5rem 0' }}>
        Please Select Language to Speak
      </p>
      <div className="language flex justify-center items-center gap-2 w-full" role="group" aria-label="Voice language" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', border: 'none', background: 'transparent', width: '100%' }}>
        {[["English", "English"], ["Hindi", "\u0939\u093F\u0928\u094D\u0926\u0940"], ["Bengali", "\u09AC\u09BE\u0982\u09B2\u09BE"]].map(([v, label]) => (
          <button key={v} className={value === v ? "bg-blue-600 text-white font-bold px-6 py-3 text-lg rounded-lg" : "bg-gray-200 text-gray-800 hover:bg-gray-300 px-6 py-3 text-lg rounded-lg"} style={value === v ? { backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold', padding: '12px 24px', fontSize: '1.125rem', borderRadius: '8px', border: 'none' } : { backgroundColor: '#e5e7eb', color: '#1f2937', padding: '12px 24px', fontSize: '1.125rem', borderRadius: '8px', border: 'none' }} onClick={() => onChange(v)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
export {
  LanguageSelector
};
