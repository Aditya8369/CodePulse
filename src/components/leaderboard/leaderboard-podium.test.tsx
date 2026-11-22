import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { LeaderboardPodium, PodiumUser } from "./leaderboard-podium";

describe("LeaderboardPodium Component", () => {
  const mockTopUsers: PodiumUser[] = [
    {
      id: "u1",
      username: "goldmaster",
      name: "Gold Champion",
      stars: 1250,
      points: 9800,
      country: "Global",
    },
    {
      id: "u2",
      username: "silverrunner",
      name: "Silver Contender",
      stars: 920,
      points: 7400,
      country: "India",
    },
    {
      id: "u3",
      username: "bronzeace",
      name: "Bronze Achiever",
      stars: 640,
      points: 5900,
      country: "USA",
    },
  ];

  it("renders Olympic Podium slots for rank 1, 2, and 3", () => {
    render(<LeaderboardPodium topUsers={mockTopUsers} categoryTitle="Global Champions" />);

    expect(screen.getByRole("region", { name: /Olympic Podium/i })).toBeInTheDocument();
    expect(screen.getByTestId("podium-slot-1")).toHaveTextContent("Gold Champion");
    expect(screen.getByTestId("podium-slot-2")).toHaveTextContent("Silver Contender");
    expect(screen.getByTestId("podium-slot-3")).toHaveTextContent("Bronze Achiever");
    expect(screen.getByText("Global Champions")).toBeInTheDocument();
  });

  it("invokes onSelectUser when a podium pillar is clicked", () => {
    const handleSelect = vi.fn();
    render(<LeaderboardPodium topUsers={mockTopUsers} onSelectUser={handleSelect} />);

    const firstPlaceSlot = screen.getByTestId("podium-slot-1");
    fireEvent.click(firstPlaceSlot);

    expect(handleSelect).toHaveBeenCalledWith(mockTopUsers[0]);
  });

  it("does not render when fewer than 3 users are provided", () => {
    const { container } = render(<LeaderboardPodium topUsers={mockTopUsers.slice(0, 2)} />);
    expect(container.firstChild).toBeNull();
  });
});
