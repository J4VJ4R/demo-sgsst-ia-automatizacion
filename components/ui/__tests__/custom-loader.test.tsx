import { render, screen, act, cleanup } from "@testing-library/react";
import { CustomLoader } from "../custom-loader";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom"; // Import matchers

// Mock next/image since it's not available in test environment
vi.mock("next/image", () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  default: ({ src, alt, unoptimized, priority, ...props }: any) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

describe("CustomLoader", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders when isLoading is true", () => {
    render(<CustomLoader isLoading={true} />);
    const loader = screen.getByTestId("custom-loader");
    expect(loader).toBeInTheDocument();
    
    // Check if image is present
    const image = screen.getByAltText("Cargando...");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute("src", "/video/logo.gif");
  });

  it("does not render when isLoading is false initially", () => {
    render(<CustomLoader isLoading={false} />);
    const loader = screen.queryByTestId("custom-loader");
    expect(loader).not.toBeInTheDocument();
  });

  it("hides after transition when isLoading changes to false", () => {
    const { rerender } = render(<CustomLoader isLoading={true} />);
    
    const loader = screen.getByTestId("custom-loader");
    expect(loader).toBeInTheDocument();

    // Change prop to false
    rerender(<CustomLoader isLoading={false} />);
    
    // Should still be in document but fading out (we can't easily check opacity transition in jsdom, but we check presence)
    expect(screen.getByTestId("custom-loader")).toBeInTheDocument();

    // Fast-forward timer (300ms)
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Now it should be removed
    expect(screen.queryByTestId("custom-loader")).not.toBeInTheDocument();
  });
});
