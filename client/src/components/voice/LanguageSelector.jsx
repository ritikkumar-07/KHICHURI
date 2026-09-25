function LanguageSelector({ value, onChange }) {
  return <div className="language" role="group" aria-label="Voice language">{[["English", "English"], ["Hindi", "\u0939\u093F\u0928\u094D\u0926\u0940"], ["Bengali", "\u09AC\u09BE\u0982\u09B2\u09BE"]].map(([v, label]) => <button key={v} className={value === v ? "selected" : ""} onClick={() => onChange(v)}>{label}</button>)}</div>;
}
export {
  LanguageSelector
};
