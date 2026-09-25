function StepByStepCard({ guide }) {
  const guideImages = {
    "CPR (Adult & Infant)": "/images/cpr-adult-infant.jpeg",
    "Severe Bleeding & Tourniquets": "/images/severe-bleeding-tourniquets.jpeg",
    "Burns & Scalds": "/images/burns-scalds.jpeg",
    "Choking (Conscious & Unconscious)": "/images/choking-conscious-unconscious.jpeg",
    "Heatstroke & Dehydration": "/images/heatstroke-dehydration.jpeg",
    "Fractures & Sprains": "/images/fractures-sprains.jpeg",
    "Stroke (FAST Protocol)": "/images/stroke-fast-protocol.jpeg",
    "Heart Attack & Chest Pain": "/images/heart-attack-chest-pain.jpeg",
    "Poisoning & Toxic Ingestion": "/images/poisoning-toxic-ingestion.jpeg",
    "Diabetic Shock (Hypoglycemia)": "/images/diabetic-shock-hypoglycemia.jpeg",
    "Asthma Attack & Anaphylaxis": "/images/asthma-attack-anaphylaxis.jpeg",
    "Snake & Insect Bites": "/images/snake-insect-bites.jpeg",
    "Seizures / Convulsions": "/images/seizures-convulsions.jpeg"
  };
  const guideImage = guideImages[guide.title];

  return <article className="panel procedure"><div className="panel-head"><span>{guide.urgency} · FIRST AID</span><small>Offline ready</small></div><h2>{guide.title}</h2><p className="warning">{guide.warning}</p>{guideImage && <img className="cpr-guide-image" src={guideImage} alt={`Illustrated first aid instructions for ${guide.title}`} width="1024" height="1024" />}<ol>{guide.steps.map((s) => <li key={s}>{s}</li>)}</ol><footer>For life-threatening symptoms or uncertainty, call 112 / local emergency services.</footer></article>;
}
export {
  StepByStepCard
};
