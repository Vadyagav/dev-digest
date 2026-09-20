import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SeverityPills } from "./SeverityPills";

afterEach(cleanup);

describe("SeverityPills", () => {
  it("renders only severities present, in CRITICAL/WARNING/SUGGESTION order", () => {
    render(<SeverityPills counts={{ SUGGESTION: 2, CRITICAL: 3 }} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders nothing when counts are empty, null, or undefined", () => {
    const { container: c1 } = render(<SeverityPills counts={{}} />);
    expect(c1).toBeEmptyDOMElement();
    cleanup();
    const { container: c2 } = render(<SeverityPills counts={null} />);
    expect(c2).toBeEmptyDOMElement();
    cleanup();
    const { container: c3 } = render(<SeverityPills counts={undefined} />);
    expect(c3).toBeEmptyDOMElement();
  });

  it("ignores a zero-count severity", () => {
    render(<SeverityPills counts={{ CRITICAL: 0, WARNING: 1 }} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
