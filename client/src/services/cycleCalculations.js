const DAY = 86400000;
export const parseDateOnly = value => { const [year, month, day] = String(value || '').split('-').map(Number); return year && month && day ? new Date(Date.UTC(year, month - 1, day)) : null; };
export const formatDateOnly = date => date ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}` : '';
export const localToday = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
export const addDays = (value, days) => { const date = parseDateOnly(value); if (!date) return ''; date.setUTCDate(date.getUTCDate() + days); return formatDateOnly(date); };
export const daysBetween = (start, end) => Math.round((parseDateOnly(end) - parseDateOnly(start)) / DAY);

export function sortedCycles(cycles = []) { return [...cycles].filter(item => parseDateOnly(item.startDate)).sort((a, b) => a.startDate.localeCompare(b.startDate)); }
export function calculateCycleLengths(cycles = []) { const ordered = sortedCycles(cycles); return ordered.slice(1).map((cycle, index) => ({ startDate: cycle.startDate, days: daysBetween(ordered[index].startDate, cycle.startDate) })).filter(item => item.days > 0 && item.days <= 180); }
export function calculatePeriodDurations(cycles = []) { return sortedCycles(cycles).filter(item => item.endDate && item.endDate >= item.startDate).map(item => ({ startDate: item.startDate, days: daysBetween(item.startDate, item.endDate) + 1 })); }
export const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function calculateCycleStatistics(cycles = [], logs = []) {
  const lengths = calculateCycleLengths(cycles), durations = calculatePeriodDurations(cycles), recentLengths = lengths.slice(-6).map(item => item.days);
  const averageCycle = average(recentLengths), averagePeriod = average(durations.slice(-6).map(item => item.days));
  const variation = recentLengths.length > 1 ? Math.max(...recentLengths) - Math.min(...recentLengths) : null;
  const painValues = logs.map(item => Number(item.pain)).filter(value => Number.isFinite(value));
  const symptomCounts = logs.flatMap(item => item.symptoms || []).reduce((counts, symptom) => ({ ...counts, [symptom]: (counts[symptom] || 0) + 1 }), {});
  return { lengths, durations, averageCycle, averagePeriod, shortest: recentLengths.length ? Math.min(...recentLengths) : null, longest: recentLengths.length ? Math.max(...recentLengths) : null, variation, averagePain: average(painValues), symptomCounts };
}

export function estimateNextPeriod(cycles = [], typicalCycleLength) {
  const ordered = sortedCycles(cycles), lengths = calculateCycleLengths(cycles).slice(-6).map(item => item.days);
  if (!ordered.length) return { date: null, confidence: 'Not enough data', explanation: 'Add your most recent period to start tracking.' };
  if (!lengths.length) {
    if (Number(typicalCycleLength) >= 15) return { date: addDays(ordered.at(-1).startDate, Math.round(Number(typicalCycleLength))), confidence: 'Low confidence', explanation: 'This estimate uses only the typical cycle length you entered. Record another period to calculate from your history.' };
    return { date: null, confidence: 'Not enough data', explanation: 'Record another period to begin estimating your cycle length.' };
  }
  const cycleAverage = average(lengths), variation = Math.max(...lengths) - Math.min(...lengths);
  const confidence = lengths.length >= 3 && variation <= 4 ? 'Higher confidence' : lengths.length >= 2 && variation <= 8 ? 'Moderate confidence' : 'Low confidence';
  const explanation = variation > 8 ? `Your recorded cycle lengths vary by ${variation} days, so this estimate may be less reliable.` : 'Based on the timing of your previously recorded period starts.';
  return { date: addDays(ordered.at(-1).startDate, Math.round(cycleAverage)), confidence, explanation, averageDays: cycleAverage, variation };
}

export function estimatedFertileWindow(nextPeriodDate) {
  if (!nextPeriodDate) return null;
  const estimatedOvulation = addDays(nextPeriodDate, -14);
  return { start: addDays(estimatedOvulation, -5), end: addDays(estimatedOvulation, 1), ovulation: estimatedOvulation };
}
