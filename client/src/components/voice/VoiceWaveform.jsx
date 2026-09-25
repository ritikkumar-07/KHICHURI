function VoiceWaveform({ state }) {
  return <div className={`wave ${state}`} aria-label={`Voice recorder ${state}`}>{Array.from({ length: 30 }, (_, i) => <i key={i} style={{ height: `${18 + i * 13 % 42}%`, animationDelay: `${i * 0.04}s` }} />)}<span>{state === "recording" ? "Listening\u2026" : state === "processing" ? "Analysing voice\u2026" : "Ready for voice check"}</span></div>;
}
export {
  VoiceWaveform
};
