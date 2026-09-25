import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

const meta = {
  GREEN: [CheckCircle2, "Low urgency \u2014 monitor symptoms"],
  YELLOW: [AlertTriangle, "Needs medical assessment"],
  RED: [ShieldAlert, "Emergency \u2014 act now"],
};

function UrgencyMeter({ urgency = "YELLOW" }) {
  const level = String(urgency || "YELLOW").toUpperCase();
  const [Icon, text] = meta[level] || meta.YELLOW;
  return (
    <div className={`urgency ${level.toLowerCase()}`}>
      <Icon size={20} />
      <div>
        <b>{level} URGENCY</b>
        <small>{text}</small>
      </div>
    </div>
  );
}

export { UrgencyMeter };
