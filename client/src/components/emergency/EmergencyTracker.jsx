import { Ambulance, CheckCircle2, Radio } from "lucide-react";
function EmergencyTracker({ alert }) {
  if (!alert) return <section className="panel tracker empty"><Radio size={22} /><div><b>Response channel standing by</b><p>Send SOS to start a clearly labelled simulated dispatch response.</p></div></section>;
  const ack = alert.status === "acknowledged" || alert.status === "dispatching" || alert.status === "en_route";
  return <section className="panel tracker"><div className="panel-head"><span>EMERGENCY RESPONSE · DEMO</span><small>{alert.id}</small></div><div className="tracker-main"><Ambulance size={36} /><div><b>{alert.status.replace("_", " ").toUpperCase()}</b><p>Simulated ambulance ETA: {alert.etaMinutes} minutes</p></div></div><div className="steps"><span className="done"><CheckCircle2 />SOS received</span><span className={ack ? "done" : ""}><CheckCircle2 />Dispatch notified</span><span className={alert.status === "en_route" ? "done" : ""}><CheckCircle2 />Ambulance en route</span></div></section>;
}
export {
  EmergencyTracker
};
