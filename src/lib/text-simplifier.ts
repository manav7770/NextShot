export function simplifyOnImageText(text: string): string {
  const simplified = text
    // Remove percentages and specs
    .replace(/\d+%\s+(?:more|less|faster|slower)/gi, (match) => {
      const word = match.split(/\s+/)[1];
      return word ? word.charAt(0).toUpperCase() + word.slice(1) : "";
    })
    // Remove technical junk like "m³/hr", "dB", "CFM", etc.
    .replace(/\b\d+\s*(?:m³\/hr|dB|CFM|RPM|W|HP|cc|ml|L|kW)\b/gi, "")
    // Remove parenthetical specs
    .replace(/\s*•\s*/g, "\n")
    .replace(/\s*[-–—]\s*(?:Inverter|Digital|Smart|Ready|Mode)/gi, "")
    .replace(/\(.*?\)/g, "")
    // Remove repeated "and" and technical keywords
    .replace(/\s+(and|or)\s+(?:more|less|faster|slower|better|energy|efficient)/gi, "\n")
    // Clean up line breaks
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.match(/^\d+[a-z]*\s*$|^[(\[].*[)\]]$/))
    .join("\n")
    // Ensure brevity
    .split("\n")
    .slice(0, 3)
    .map((line) => {
      if (line.length > 30) {
        return line.split(/\s+/).slice(0, 5).join(" ");
      }
      return line;
    })
    .join("\n");

  return simplified || text;
}
