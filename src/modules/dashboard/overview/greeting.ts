export function greetingKeyForHour(hour: number) {
  if (hour >= 5 && hour < 11) return "dashboard.snapshot.greeting" as const;
  if (hour >= 11 && hour < 14)
    return "dashboard.snapshot.greetingNoon" as const;
  if (hour >= 14 && hour < 18)
    return "dashboard.snapshot.greetingAfternoon" as const;
  return "dashboard.snapshot.greetingEvening" as const;
}
