import { describe, it, expect } from "vitest";
import {
  PERSONALITIES,
  DEFAULT_PERSONALITY,
  getPersonality,
  getAllPersonalities,
} from "@/lib/ai/personalities";

describe("personalities", () => {
  describe("PERSONALITIES", () => {
    it("should have three personalities defined", () => {
      expect(Object.keys(PERSONALITIES)).toHaveLength(3);
    });

    it("should have kukui, oak, and blue personalities", () => {
      expect(PERSONALITIES.kukui).toBeDefined();
      expect(PERSONALITIES.oak).toBeDefined();
      expect(PERSONALITIES.blue).toBeDefined();
    });

    it("each personality should have required fields", () => {
      const requiredFields = [
        "id",
        "name",
        "title",
        "avatar",
        "accentColor",
        "thinkingMessage",
        "systemPromptPrefix",
      ] as const;

      for (const personality of Object.values(PERSONALITIES)) {
        for (const field of requiredFields) {
          expect(personality).toHaveProperty(field);
          expect(personality[field]).toBeTruthy();
        }
      }
    });
  });

  describe("DEFAULT_PERSONALITY", () => {
    it("should be kukui", () => {
      expect(DEFAULT_PERSONALITY).toBe("kukui");
    });

    it("should be a valid personality id", () => {
      expect(PERSONALITIES[DEFAULT_PERSONALITY]).toBeDefined();
    });
  });

  describe("getPersonality", () => {
    it("should return the correct personality for kukui", () => {
      const personality = getPersonality("kukui");
      expect(personality.id).toBe("kukui");
      expect(personality.name).toBe("Professor Kukui");
    });

    it("should return the correct personality for oak", () => {
      const personality = getPersonality("oak");
      expect(personality.id).toBe("oak");
      expect(personality.name).toBe("Professor Oak");
    });

    it("should return the correct personality for blue", () => {
      const personality = getPersonality("blue");
      expect(personality.id).toBe("blue");
      expect(personality.name).toBe("Blue");
    });

    it("should return default personality for invalid id", () => {
      // @ts-expect-error Testing invalid input
      const personality = getPersonality("invalid");
      expect(personality.id).toBe(DEFAULT_PERSONALITY);
    });
  });

  describe("getAllPersonalities", () => {
    it("should return all personalities as an array", () => {
      const personalities = getAllPersonalities();
      expect(Array.isArray(personalities)).toBe(true);
      expect(personalities).toHaveLength(3);
    });

    it("should include all personality ids", () => {
      const personalities = getAllPersonalities();
      const ids = personalities.map((p) => p.id);
      expect(ids).toContain("kukui");
      expect(ids).toContain("oak");
      expect(ids).toContain("blue");
    });
  });

  describe("personality content", () => {
    describe("Professor Kukui", () => {
      const kukui = PERSONALITIES.kukui;

      it("should have enthusiastic theme", () => {
        expect(kukui.systemPromptPrefix).toContain("enthusiastic");
        expect(kukui.thinkingMessage).toContain("yeah");
      });

      it("should reference Alola", () => {
        expect(kukui.title).toContain("Alola");
        expect(kukui.systemPromptPrefix).toContain("Alola");
      });
    });

    describe("Professor Oak", () => {
      const oak = PERSONALITIES.oak;

      it("should have wise/mentor theme", () => {
        expect(oak.systemPromptPrefix).toContain("wisdom");
      });

      it("should reference Kanto", () => {
        expect(oak.title).toContain("Kanto");
      });

      it("should have research-themed thinking message", () => {
        expect(oak.thinkingMessage).toContain("research");
      });
    });

    describe("Rival Blue", () => {
      const blue = PERSONALITIES.blue;

      it("should have champion theme", () => {
        expect(blue.title).toContain("Champion");
        expect(blue.systemPromptPrefix).toContain("Champion");
      });

      it("should have confident/cocky personality", () => {
        expect(blue.systemPromptPrefix).toContain("confident");
      });

      it("should reference signature catchphrase", () => {
        expect(blue.systemPromptPrefix).toContain("Smell ya later");
      });
    });
  });
});
