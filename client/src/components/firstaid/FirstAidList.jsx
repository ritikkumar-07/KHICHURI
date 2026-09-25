import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { FIRST_AID_SEARCH_ALIASES } from "../../services/offlineStorage";
import { rankFirstAid } from "../../services/firstAidSearch";

function HighlightedTitle({ title, prefixLength }) {
  if (!prefixLength) return <b>{title}</b>;
  return <b><mark className="firstaid-title-match">{title.slice(0, prefixLength)}</mark>{title.slice(prefixLength)}</b>;
}

function FirstAidList({ guides, onSelect }) {
  const [query, setQuery] = useState(""), [activeIndex, setActiveIndex] = useState(0), [open, setOpen] = useState(true);
  const results = rankFirstAid(guides, query, FIRST_AID_SEARCH_ALIASES);
  useEffect(() => { setActiveIndex(0); setOpen(true); }, [query]);
  const choose = result => { onSelect(result.guide); setOpen(false); };
  const keyDown = event => {
    if (event.key === "ArrowDown" && results.length) { event.preventDefault(); setOpen(true); setActiveIndex(index => (index + 1) % results.length); }
    else if (event.key === "ArrowUp" && results.length) { event.preventDefault(); setOpen(true); setActiveIndex(index => (index - 1 + results.length) % results.length); }
    else if (event.key === "Enter" && open && results[activeIndex]) { event.preventDefault(); choose(results[activeIndex]); }
    else if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
  };
  return <section className="panel guide-list"><div className="search"><Search size={16} /><input role="combobox" aria-expanded={open} aria-controls="firstaid-results" aria-activedescendant={open && results[activeIndex] ? `firstaid-option-${activeIndex}` : undefined} value={query} onChange={event => setQuery(event.target.value)} onFocus={() => setOpen(true)} onKeyDown={keyDown} placeholder="Search first aid or describe the problem..." aria-label="Search first aid guides; spelling mistakes and problem descriptions are supported" /></div><div id="firstaid-results" role="listbox">{open && results.map((result, index) => <button id={`firstaid-option-${index}`} role="option" aria-selected={index === activeIndex} className={index === activeIndex ? "firstaid-active-result" : ""} key={result.guide.title} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(result)}><span className={`dot ${result.guide.urgency.toLowerCase()}`} /><div><HighlightedTitle title={result.guide.title} prefixLength={result.prefixLength} /><small>{result.guide.category}</small>{result.matchType === "fuzzy" && <small className="firstaid-correction">Possible spelling correction for <span>“{query.trim()}”</span></small>}</div><em>{result.guide.urgency}</em></button>)}{open && query.trim() && !results.length && <div className="empty"><small>No strong First Aid match found. Try describing the main problem with simple words.</small></div>}</div></section>;
}
export { FirstAidList };
