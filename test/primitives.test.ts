import { describe, expect, it } from "vitest";
import { escapeXml, measureText, svgDocument, textPath, truncateToWidth } from "../src/svg/primitives";

describe("primitives", () => {
  it("escapes xml special chars", () => {
    expect(escapeXml('a & <b> "c"')).toBe("a &amp; &lt;b&gt; &quot;c&quot;");
  });

  it("renders text as an svg path element", () => {
    const out = textPath({ text: "Hi", x: 0, y: 20, size: 14, weight: "regular", color: "#000" });
    expect(out).toContain("<path");
    expect(out).toContain('fill="#000"');
  });

  it("measures advance width as a positive number", () => {
    expect(measureText("Hello", 14, "regular")).toBeGreaterThan(0);
  });

  it("truncates long text with an ellipsis to fit width", () => {
    const full = "a-very-long-package-name-that-will-not-fit";
    const out = truncateToWidth(full, 14, "regular", 60);
    expect(out.endsWith("…")).toBe(true);
    expect(measureText(out, 14, "regular")).toBeLessThanOrEqual(60);
  });

  it("wraps content in an svg document with viewBox", () => {
    const doc = svgDocument(100, 50, "<rect />");
    expect(doc).toContain('viewBox="0 0 100 50"');
    expect(doc).toContain("<rect />");
  });
});
