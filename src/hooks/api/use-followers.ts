import { useState, useEffect } from 'react';

export interface FollowerActivityItem {
  id: string;
  actorUsername: string;
  actorName: string;
  actorAvatar: string;
  actionText: string;
  timestamp: string;
  reactionCount: number;
}

export function useFollowerActivity() {
  const [followingActivities, setFollowingActivities] = useState<FollowerActivityItem[]>([
    {
      id: 'act_1',
      actorUsername: 'alexmercer',
      actorName: 'Alex Mercer',
      actorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop',
      actionText: 'won a 1v1 DevBattle against @sarah_dev in TypeScript Arena (+100 XP)',
      timestamp: '12m ago',
      reactionCount: 4,
    },
    {
      id: 'act_2',
      actorUsername: 'elena_rust',
      actorName: 'Elena Rostova',
      actorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&h=80&fit=crop',
      actionText: 'reached Level 20: Diamond Grandmaster!',
      timestamp: '45m ago',
      reactionCount: 12,
    },
    {
      id: 'act_3',
      actorUsername: 'priya_code',
      actorName: 'Priya Sharma',
      actorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop',
      actionText: 'unlocked the "Open Source Titan" achievement',
      timestamp: '2h ago',
      reactionCount: 8,
    },
  ]);

  const reactToActivity = (id: string) => {
    setFollowingActivities(prev =>
      prev.map(item =>
        item.id === id ? { ...item, reactionCount: item.reactionCount + 1 } : item
      )
    );
  };

  return {
    followingActivities,
    reactToActivity,
  };
}
