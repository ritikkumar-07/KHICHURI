const FIRST_AID = [
  { title: "CPR (Adult & Infant)", category: "Cardiac emergency", urgency: "RED", warning: "Only begin if the person is unresponsive and not breathing normally.", steps: ["Check responsiveness and breathing for 10 seconds.", "Place heel of hand on center of chest; interlock fingers.", "Deliver 30 hard and fast compressions (100–120 bpm, 2 inches deep).", "Give 2 rescue breaths; repeat cycle until emergency team arrives."] },
  { title: "Severe Bleeding & Tourniquets", category: "Trauma", urgency: "RED", warning: "Life-threatening bleeding needs emergency care immediately.", steps: ["Apply firm, direct pressure on the wound using sterile gauze or clean cloth.", "Elevate the injured limb above heart level.", "Apply a pressure bandage; if bleeding does not stop, apply a tourniquet 2 inches above the wound.", "Do not remove soaked bandages; add more layers on top."] },
  { title: "Burns & Scalds", category: "Thermal injury", urgency: "YELLOW", warning: "Seek urgent care for large, deep, electrical, chemical, face, hand, foot, or genital burns.", steps: ["Cool burn immediately under cool running water for 10–20 minutes.", "Remove loose jewelry before swelling begins.", "Cover loosely with sterile, non-stick cling film or dressing.", "DO NOT: Apply ice, butter, oil, or pop burn blisters."] },
  { title: "Choking (Conscious & Unconscious)", category: "Airway emergency", urgency: "RED", warning: "Call emergency services if the person cannot breathe, cough, or speak.", steps: ["Stand behind the person and lean them slightly forward.", "Give 5 firm back blows between shoulder blades.", "Perform 5 abdominal thrusts (Heimlich maneuver) inward and upward above the navel.", "Alternate 5 back blows and 5 thrusts until obstruction clears."] },
  { title: "Heatstroke & Dehydration", category: "Heat illness", urgency: "RED", warning: "Confusion, collapse, or very hot skin in heat can be life-threatening.", steps: ["Call 112 and move the person to a cool shaded area.", "Remove excess clothing and cool quickly with wet cloths, fanning, or cool water.", "If fully alert, give small sips of cool water; do not force fluids."] },
  { title: "Fractures & Sprains", category: "Orthopedic injury", urgency: "YELLOW", warning: "Do not move the person if a spinal or neck injury is suspected.", steps: ["Immobilize the injured area; do not attempt to realign the bone.", "Apply a padded splint above and below the joint.", "Apply ice packs wrapped in cloth for 15 minutes to reduce swelling."] },
  { title: "Seizures / Convulsions", category: "Neurological", urgency: "RED", warning: "Call 112 if the seizure lasts more than 5 minutes or they have difficulty breathing afterwards.", steps: ["Clear the surrounding area of sharp or hard objects.", "Cushion the head and gently roll the person onto their side (recovery position).", "Time the seizure.", "DO NOT: Hold them down or place any object inside their mouth."] },
  { title: "Heart Attack & Chest Pain", category: "Vascular emergency", urgency: "RED", warning: "Call 112 immediately. Time is critical.", steps: ["Sit them comfortably on the floor, loosen tight clothing.", "If prescribed, help them take their angina medication.", "If advised by emergency dispatch, give them an adult aspirin (300mg) to chew."] },
  { title: "Stroke (FAST Protocol)", category: "Neurological emergency", urgency: "RED", warning: "Call 112 immediately. Time is critical to save brain function.", steps: ["F (Face): Ask them to smile (check for facial droop).", "A (Arms): Ask them to raise both arms (check for drift).", "S (Speech): Ask them to repeat a simple sentence (check for slurred speech).", "T (Time): Record exact time symptoms began and transport immediately."] },
  { title: "Poisoning & Toxic Ingestion", category: "Toxicological", urgency: "RED", warning: "Do not make the person vomit unless instructed by a medical professional.", steps: ["Call 112 or a poison control center immediately.", "Find out what was taken, when, and how much.", "If unconscious but breathing normally, place in the recovery position."] },
  { title: "Snake & Insect Bites", category: "Envenomation", urgency: "RED", warning: "Do not attempt to suck out the venom or apply a tourniquet.", steps: ["Keep victim calm and immobilize the bitten limb below heart level.", "Remove tight clothing, rings, and jewelry near the bite area.", "Wash with soap and clean water; cover with dry, sterile dressing.", "DO NOT: Cut the wound, attempt to suck venom, or apply ice/tourniquets."] },
  { title: "Asthma Attack & Anaphylaxis", category: "Respiratory emergency", urgency: "RED", warning: "Call 112 immediately if there is swelling of the face/throat or difficulty breathing.", steps: ["Asthma: Help them sit upright and use their reliever inhaler (blue).", "Anaphylaxis: If they have an adrenaline auto-injector (EpiPen), help them use it.", "If no improvement after 5 minutes, give a second dose of adrenaline if available."] },
  { title: "Diabetic Shock (Hypoglycemia)", category: "Metabolic emergency", urgency: "YELLOW", warning: "If the person becomes unconscious, do not put anything in their mouth.", steps: ["If conscious, give them 15-20 grams of fast-acting carbohydrates (fruit juice, candy).", "Wait 15 minutes and recheck symptoms. Give more carbs if no improvement.", "Once they feel better, give them a longer-acting carbohydrate snack like a sandwich."] }
];
const FIRST_AID_SEARCH_ALIASES = {
  "CPR (Adult & Infant)": ["cardiac arrest", "not breathing", "no pulse", "unresponsive", "unconscious", "baby", "infant"],
  "Severe Bleeding & Tourniquets": ["bleeding", "blood", "heavy bleeding", "deep cut", "wound", "blood loss", "tourniquet"],
  "Burns & Scalds": ["burn", "burned", "burning hand", "hot water", "boiling water", "fire", "skin burn", "scald"],
  "Choking (Conscious & Unconscious)": ["choke", "choking", "food stuck", "throat blocked", "something stuck throat", "cant breathe"],
  "Heatstroke & Dehydration": ["dehydration", "dehydrated", "thirst", "thirsty", "dry mouth", "no water", "weakness", "dizzy", "dizziness", "heat", "hot sun"],
  "Fractures & Sprains": ["fracture", "broken bone", "bone injury", "sprain", "twisted ankle"],
  "Seizures / Convulsions": ["seizure", "fits", "convulsion", "shaking", "epilepsy"],
  "Heart Attack & Chest Pain": ["heart attack", "chest pain", "chest pressure", "cardiac pain"],
  "Stroke (FAST Protocol)": ["stroke", "face droop", "slurred speech", "arm weakness", "fast"],
  "Poisoning & Toxic Ingestion": ["poison", "poisoning", "swallowed chemical", "toxic", "overdose"],
  "Snake & Insect Bites": ["snake bite", "insect bite", "venom", "bee sting", "bite"],
  "Asthma Attack & Anaphylaxis": ["asthma", "allergic reaction", "anaphylaxis", "wheezing", "swollen throat", "cant breathe"],
  "Diabetic Shock (Hypoglycemia)": ["diabetic shock", "low sugar", "low blood sugar", "hypoglycemia", "diabetes dizzy"]
};
const key = "sanjeevani-first-aid";
function getFirstAid() {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || FIRST_AID;
  } catch {
    return FIRST_AID;
  }
}
function cacheFirstAid() {
  try {
    localStorage.setItem(key, JSON.stringify(FIRST_AID));
  } catch {
  }
}
export {
  FIRST_AID,
  FIRST_AID_SEARCH_ALIASES,
  cacheFirstAid,
  getFirstAid
};
