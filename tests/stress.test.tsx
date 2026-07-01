import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Card01 } from "../src/components/Card01";
import { Card05 } from "../src/components/Card05";
import { Card10 } from "../src/components/Card10";
import { Card15 } from "../src/components/Card15";
import { Card20 } from "../src/components/Card20";
import { Card25 } from "../src/components/Card25";
import { Card30 } from "../src/components/Card30";
import { Card35 } from "../src/components/Card35";
import { Card40 } from "../src/components/Card40";

// 実アプリの規模感 (数百〜数千 render / スイート) に寄せるためのストレステスト。
// CI で test task が数十秒かかる状態を作り、job 並列化の効果を測るのが目的。
const ITERATIONS = 3000;

const CARDS = [Card01, Card05, Card10, Card15, Card20, Card25, Card30, Card35, Card40] as const;

const VARIANTS = ["primary", "secondary", "subtle", "danger"] as const;
const SIZES = ["sm", "md", "lg"] as const;

afterEach(() => cleanup());

describe("stress: bulk render", () => {
  for (const Card of CARDS) {
    it(`renders ${Card.name} ${ITERATIONS} times with varying props`, () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const badge = i % 10 === 0 ? { badge: i } : {};
        const { unmount } = render(
          <Card
            title={`title-${i}`}
            description={"x".repeat(50 + (i % 40))}
            variant={VARIANTS[i % VARIANTS.length]}
            size={SIZES[i % SIZES.length]}
            truncateAt={20 + (i % 30)}
            {...badge}
          />,
        );
        unmount();
      }
      expect(true).toBe(true);
    });
  }
});

describe("stress: interaction loop", () => {
  it("clicks Expand/Collapse many times", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const { unmount } = render(<Card01 title={`t-${i}`} />);
      const btn = screen.getByRole("button", { name: "Expand" });
      fireEvent.click(btn);
      fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
      unmount();
    }
    expect(true).toBe(true);
  });
});
