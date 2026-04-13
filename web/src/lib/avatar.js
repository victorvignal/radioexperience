export function getInitials(name, fallback = "U") {
  const normalized = (name || "").trim();
  if (!normalized) return fallback;

  const initials = normalized
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || fallback;
}
