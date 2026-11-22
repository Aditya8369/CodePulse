import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { FollowButton } from "./follow-button";

// Mock hooks
const mockFollow = vi.fn();
const mockUnfollow = vi.fn();

vi.mock("@/hooks/api/use-friends", () => ({
  useFollowStatus: () => ({
    isFollowing: false,
    followersCount: 15,
    follow: mockFollow,
    unfollow: mockUnfollow,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("FollowButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders follow button and real-time follower counter badge", () => {
    render(
      <FollowButton
        targetUserId="user-123"
        targetUsername="alex_coder"
        initialFollowing={false}
        initialFollowersCount={42}
      />
    );

    expect(screen.getByTestId("follow-toggle-btn")).toBeInTheDocument();
    expect(screen.getByText("Follow")).toBeInTheDocument();
    expect(screen.getByTestId("follower-counter-badge")).toHaveTextContent("42");
  });

  it("optimistically toggles follow state and increments follower counter", async () => {
    const onFollowChange = vi.fn();

    render(
      <FollowButton
        targetUserId="user-123"
        targetUsername="alex_coder"
        initialFollowing={false}
        initialFollowersCount={42}
        onFollowChange={onFollowChange}
      />
    );

    const btn = screen.getByTestId("follow-toggle-btn");
    fireEvent.click(btn);

    // Follower counter optimistically incremented
    expect(screen.getByTestId("follower-counter-badge")).toHaveTextContent("43");
    expect(onFollowChange).toHaveBeenCalledWith(true, 43);
    expect(mockFollow).toHaveBeenCalledWith("user-123");
  });

  it("optimistically unfollows and decrements follower counter", async () => {
    const onFollowChange = vi.fn();

    render(
      <FollowButton
        targetUserId="user-123"
        targetUsername="alex_coder"
        initialFollowing={true}
        initialFollowersCount={50}
        onFollowChange={onFollowChange}
      />
    );

    const btn = screen.getByTestId("follow-toggle-btn");
    expect(screen.getByText("Following")).toBeInTheDocument();

    fireEvent.click(btn);

    // Follower counter optimistically decremented
    expect(screen.getByTestId("follower-counter-badge")).toHaveTextContent("49");
    expect(onFollowChange).toHaveBeenCalledWith(false, 49);
    expect(mockUnfollow).toHaveBeenCalledWith("user-123");
  });
});
