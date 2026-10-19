import { describe, expect, it, vi, afterEach } from "vitest";
import { assessBufferBudget, readBufferRateWindows } from "../src/core/free-budget.js";
import { assertCloudinaryFreeCredits, CloudinaryBudgetError } from "../src/media/cloudinary.js";

const headers = (left30: number, leftDay = 240) =>
  `"100-in-15min";r=95;t=100, "250-in-1day";r=${leftDay};t=100, "3000-in-30days";r=${left30};t=100`;

afterEach(() => vi.unstubAllGlobals());

describe("free-tier budget", () => {
  it("permits spending below conservative Buffer operating ceilings", () => {
    expect(assessBufferBudget(readBufferRateWindows(headers(601)))).toBeNull();
  });
  it("holds when 30-day Buffer operations reach 2400/3000", () => {
    expect(assessBufferBudget(readBufferRateWindows(headers(600)))).toContain("budget reached");
  });
  it("holds when daily Buffer operations reach 80/250", () => {
    expect(assessBufferBudget(readBufferRateWindows(headers(2900, 170)))).toContain("budget reached");
  });
  it("holds on missing provider rate-limit headers", () => {
    expect(assessBufferBudget(readBufferRateWindows(null))).toContain("missing");
  });
  it("allows Cloudinary at 19/25 credits, pauses at 20/25", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(
      JSON.stringify({ credits: { usage: 19, limit: 25 } }), { status: 200 }
    )).mockResolvedValueOnce(new Response(
      JSON.stringify({ credits: { usage: 20, limit: 25 } }), { status: 200 }
    )));
    const cfg = { cloudName: "test", apiKey: "key", apiSecret: "secret" };
    await expect(assertCloudinaryFreeCredits(cfg)).resolves.toBeUndefined();
    await expect(assertCloudinaryFreeCredits(cfg)).rejects.toBeInstanceOf(CloudinaryBudgetError);
  });
  it("refuses Cloudinary uploads if account credit usage is unknown", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    await expect(assertCloudinaryFreeCredits({ cloudName: "test", apiKey: "key", apiSecret: "secret" }))
      .rejects.toBeInstanceOf(CloudinaryBudgetError);
  });
});
