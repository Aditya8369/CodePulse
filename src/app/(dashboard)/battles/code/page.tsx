'use client';

import React from 'react';
import { CodeArenaEditor } from '@/components/battles/code-arena-editor';

export default function CodeArenaPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl space-y-6">
      <CodeArenaEditor
        problemTitle="Two Sum - Target Pair Indices"
        problemDescription="Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice."
      />
    </div>
  );
}
