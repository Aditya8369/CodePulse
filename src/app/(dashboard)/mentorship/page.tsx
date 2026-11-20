'use client';

import React from 'react';
import { Users2, Compass, Filter } from 'lucide-react';
import { MentorCard } from '@/components/cards/mentor-card';

export default function MentorshipPage() {
  const mentors = [
    {
      name: 'Elena Rostova',
      username: 'elena_rust',
      avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&h=120&fit=crop&crop=face',
      similarityScore: 94,
      matchingTech: ['TypeScript', 'Rust', 'Docker', 'PostgreSQL'],
      experienceGap: 5,
      bio: 'Staff Systems Engineer specializing in distributed databases and high-throughput async Rust microservices.',
    },
    {
      name: 'Marcus Vance',
      username: 'marcus_fullstack',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=face',
      similarityScore: 88,
      matchingTech: ['TypeScript', 'React', 'Next.js', 'Tailwind'],
      experienceGap: 4,
      bio: 'Frontend Architect passionate about web performance, design systems, and modern component accessibility.',
    },
    {
      name: 'Aisha Patel',
      username: 'aisha_cloud',
      avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&h=120&fit=crop&crop=face',
      similarityScore: 82,
      matchingTech: ['Go', 'Kubernetes', 'PostgreSQL', 'Redis'],
      experienceGap: 6,
      bio: 'DevOps & Site Reliability Engineer at scale. Happy to help aspiring cloud engineers navigate k8s operators.',
    },
  ];

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground flex items-center gap-3">
            <Users2 className="h-8 w-8 text-primary" />
            Developer Mentorship & Pair Engine
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Matched via multi-dimensional cosine similarity across your repository languages and commits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="px-3.5 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold flex items-center gap-2 hover:bg-secondary/80 transition">
            <Filter className="w-3.5 h-3.5" /> Filter by Stack
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mentors.map(mentor => (
          <MentorCard key={mentor.username} mentor={mentor} />
        ))}
      </div>
    </div>
  );
}
