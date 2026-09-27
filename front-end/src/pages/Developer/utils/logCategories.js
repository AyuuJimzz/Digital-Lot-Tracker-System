const eventText = (log) => {
  if (typeof log.event === "string") return log.event;
  if (log.event == null) return "";
  return typeof log.event === "object" ? JSON.stringify(log.event) : String(log.event);
};

export const getCategoryLogs = (logs, category) =>
  (logs || []).filter((log) => {
    const type = String(log.type || "").toUpperCase();
    const event = eventText(log);

    switch (category) {
      case "AUTH":
        return type === "AUTH";
      case "SECURITY":
        return ["SECURITY", "ERROR", "CRASH"].includes(type) ||
          event.includes("KILL SWITCH") || event.includes("System Error");
      case "DATABASE":
        return ["DATABASE", "BACKUP"].includes(type) ||
          event.includes("demo") || event.includes("Capstone") || event.includes("Purge");
      case "SYSTEM":
        return ["MAINTENANCE", "SYSTEM", "ADMIN", "EMAIL"].includes(type);
      default:
        return [];
    }
  });
