// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BrandLoader } from "@/components/ui/BrandLoader";

afterEach(cleanup);

describe("BrandLoader", () => {
  it("announces page loading with a helpful title and message", () => {
    render(<BrandLoader variant="page" title="Loading workspace" message="Restoring notes" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading workspace");
    expect(screen.getByRole("status")).toHaveTextContent("Restoring notes");
  });

  it("announces compact inline loading when given a label", () => {
    render(<BrandLoader size="xs" title="Saving notes" />);

    expect(screen.getByRole("status", { name: "Saving notes" })).toBeInTheDocument();
  });

  it("keeps decorative button marks out of the accessibility tree", () => {
    const { container } = render(<BrandLoader size="xs" />);

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
