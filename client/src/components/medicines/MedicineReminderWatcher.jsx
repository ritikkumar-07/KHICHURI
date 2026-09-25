import { useEffect, useState } from "react";
import { api } from "../../services/api";
import { localToday } from "../../services/cycleCalculations";

const idOf = (item) => item?._id || item?.id || item?.title;
const shown = new Set();

export function MedicineReminderWatcher() {
  const [medicines, setMedicines] = useState([]);

  useEffect(() => {
    // Request permission if not yet decided
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const loadFromLocalStorage = () => {
      try {
        const localData = JSON.parse(
          localStorage.getItem("sanjeevani_health_profile") || "{}"
        );
        setMedicines(
          (localData?.history || []).filter(
            (item) => item?.category === "Medicine"
          )
        );
      } catch {
        setMedicines([]);
      }
    };

    const load = () => {
      try {
        if (typeof api?.healthTracker?.load === "function") {
          const promise = api.healthTracker.load();
          if (promise && typeof promise.then === "function") {
            promise
              .then((profile) =>
                setMedicines(
                  (profile?.history || []).filter(
                    (item) => item?.category === "Medicine"
                  )
                )
              )
              .catch(() => loadFromLocalStorage());
            return;
          }
        }
        loadFromLocalStorage();
      } catch (err) {
        loadFromLocalStorage();
      }
    };

    load();
    window.addEventListener("sanjeevani-reminders-changed", load);
    return () =>
      window.removeEventListener("sanjeevani-reminders-changed", load);
  }, []);

  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted")
      return;

    const check = () => {
      const date =
        typeof localToday === "function"
          ? localToday()
          : new Date().toISOString().slice(0, 10);
      const time = new Date().toTimeString().slice(0, 5);

      medicines
        .filter(
          (item) =>
            item?.reminder?.enabled &&
            date >= (item.reminder.startDate || "") &&
            (!item.reminder.endDate || date <= item.reminder.endDate) &&
            Array.isArray(item.reminder.times) &&
            item.reminder.times.includes(time)
        )
        .forEach((item) => {
          const key = `${idOf(item)}-${date}-${time}`;
          const taken = item.reminder.taken?.some(
            (entry) => entry.date === date && entry.time === time
          );
          if (!taken && !shown.has(key)) {
            shown.add(key);
            try {
              new Notification("💊 Medicine Reminder", {
                body: `Time to take your recorded medicine: ${item.title || "Prescribed Dose"}${
                  item.formStrength ? ` (${item.formStrength})` : ""
                }`,
                tag: key,
              });
            } catch {
              /* Browser notifications fallback */
            }
          }
        });
    };

    check();
    const timer = window.setInterval(check, 20000);
    return () => window.clearInterval(timer);
  }, [medicines]);

  return null;
}