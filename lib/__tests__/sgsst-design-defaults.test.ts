import { describe, it, expect } from "vitest";
import { getDefaultSgSstDesignSections } from "@/lib/sgsst-design-defaults";

describe("getDefaultSgSstDesignSections", () => {
  it("returns 7 predefined section names in order", () => {
    const sections = getDefaultSgSstDesignSections();
    expect(sections).toHaveLength(7);
    expect(sections[0]).toBe("Políticas y documentos");
    expect(sections[6]).toBe("Formatos");
  });
});

