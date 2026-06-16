import { describe, expect, it } from "vitest";
import { linkedPicture, picture, replaceBlock } from "../src/readme";

describe("readme assembly", () => {
  it("replaces content between markers, preserving intro and outro", () => {
    const md = "Intro\n<!-- METRICS:START -->\nold\n<!-- METRICS:END -->\nOutro";
    const out = replaceBlock(md, "NEW");
    expect(out).toContain("Intro");
    expect(out).toContain("Outro");
    expect(out).toContain("NEW");
    expect(out).not.toContain("old");
  });

  it("appends a block if markers are absent", () => {
    const out = replaceBlock("Just intro", "NEW");
    expect(out).toContain("<!-- METRICS:START -->");
    expect(out).toContain("NEW");
    expect(out).toContain("<!-- METRICS:END -->");
  });

  it("builds a theme-adaptive picture element", () => {
    const out = picture("assets/x.light.svg", "assets/x.dark.svg", "alt", 420);
    expect(out).toContain("prefers-color-scheme: dark");
    expect(out).toContain("assets/x.dark.svg");
    expect(out).toContain('width="420"');
  });

  it("wraps a picture in a link", () => {
    const out = linkedPicture("https://x", "assets/x.light.svg", "assets/x.dark.svg", "alt", 420);
    expect(out).toContain('<a href="https://x"');
    expect(out).toContain("</a>");
  });
});
