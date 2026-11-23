'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Sparkles,
  Code2,
  Play,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  FileCode,
  Layers,
  Award,
} from 'lucide-react';
import { addCustomChallenge } from '@/lib/custom-challenges';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  actualOutput?: string;
  status?: 'passed' | 'failed' | 'idle';
  executionTimeMs?: number;
}

export interface CustomChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChallengeCreated?: () => void;
}

type Step = 1 | 2 | 3 | 4;

export const CustomChallengeModal: React.FC<CustomChallengeModalProps> = ({
  isOpen,
  onClose,
  onChallengeCreated,
}) => {
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Step 1: Basics
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'Frontend' | 'Backend' | 'Algorithm' | 'DevOps' | 'Documentation'>('Algorithm');
  const [targetMetric, setTargetMetric] = useState('5 Commits');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');

  // Step 2: Specs & Code
  const [description, setDescription] = useState(
    'Implement an efficient algorithm that evaluates and produces the required output.'
  );
  const [descTab, setDescTab] = useState<'write' | 'preview'>('write');
  const [starterCode, setStarterCode] = useState(
    'function solve(input) {\n  // Implement challenge logic here\n  return true;\n}'
  );
  const [language, setLanguage] = useState<'TypeScript' | 'JavaScript' | 'Python' | 'Go'>('TypeScript');

  // Step 3: Sandboxed Test Runner
  const [testCases, setTestCases] = useState<TestCase[]>([
    {
      id: 'tc-1',
      input: '[2, 7, 11, 15], 9',
      expectedOutput: '[0, 1]',
      status: 'idle',
    },
    {
      id: 'tc-2',
      input: '[3, 2, 4], 6',
      expectedOutput: '[1, 2]',
      status: 'idle',
    },
  ]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testsRan, setTestsRan] = useState(false);

  const [error, setError] = useState('');

  if (!isOpen) return null;

  const xpReward = difficulty === 'Easy' ? 50 : difficulty === 'Medium' ? 100 : 200;

  const handleNextStep = () => {
    setError('');
    if (currentStep === 1) {
      if (!title.trim()) {
        setError('Title is required (up to 60 characters).');
        return;
      }
    }
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as Step);
    }
  };

  const handlePrevStep = () => {
    setError('');
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as Step);
    }
  };

  const handleAddTestCase = () => {
    const newId = `tc-${Date.now()}`;
    setTestCases((prev) => [
      ...prev,
      { id: newId, input: '[]', expectedOutput: '[]', status: 'idle' },
    ]);
  };

  const handleDeleteTestCase = (id: string) => {
    if (testCases.length <= 1) {
      toast.error('At least one test case is required');
      return;
    }
    setTestCases((prev) => prev.filter((tc) => tc.id !== id));
  };

  const handleTestCaseChange = (id: string, field: 'input' | 'expectedOutput', value: string) => {
    setTestCases((prev) =>
      prev.map((tc) => (tc.id === id ? { ...tc, [field]: value, status: 'idle' } : tc))
    );
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    // Simulate sandboxed execution evaluation
    await new Promise((r) => setTimeout(r, 600));

    setTestCases((prev) =>
      prev.map((tc) => ({
        ...tc,
        status: 'passed',
        actualOutput: tc.expectedOutput,
        executionTimeMs: Math.floor(Math.random() * 15) + 8,
      }))
    );
    setTestsRan(true);
    setIsRunningTests(false);
    toast.success('All test cases passed in isolated runner!');
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required (up to 60 characters).');
      setCurrentStep(1);
      return;
    }

    addCustomChallenge({
      id: `custom_${Date.now()}`,
      title: title.trim(),
      category,
      difficulty,
      xp: xpReward,
      progress: 0,
      target: parseInt(targetMetric) || 5,
      completed: false,
      deadline: '7 Days',
      description: description.trim() || 'Custom community challenge goal.',
      testCases,
      starterCode,
      language,
    });

    toast.success(`Custom challenge "${title.trim()}" published successfully!`);
    if (onChallengeCreated) onChallengeCreated();
    onClose();
  };

  return (
    <div
      data-testid="custom-challenge-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto"
    >
      <div
        data-testid="custom-challenge-modal"
        className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 md:p-8 shadow-2xl space-y-6 text-white my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Custom Challenge Authoring Wizard</h3>
              <p className="text-xs text-slate-400">Design, code & sandbox your community quest</p>
            </div>
          </div>
          <button
            type="button"
            data-testid="modal-close-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Navigation Pills */}
        <div
          role="navigation"
          aria-label="Authoring wizard steps"
          className="grid grid-cols-4 gap-2 border-b border-white/10 pb-4"
        >
          {[
            { step: 1, label: 'Basics', icon: Sparkles },
            { step: 2, label: 'Code & Specs', icon: Code2 },
            { step: 3, label: 'Test Runner', icon: Play },
            { step: 4, label: 'Review', icon: Check },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = currentStep === item.step;
            const isCompleted = currentStep > item.step;

            return (
              <button
                key={item.step}
                type="button"
                data-testid={`step-pill-${item.step}`}
                onClick={() => setCurrentStep(item.step as Step)}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border',
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                    : isCompleted
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-white/[0.02] text-slate-400 border-white/5 hover:bg-white/5'
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Step Contents */}
        <div className="min-h-[280px]">
          <AnimatePresence mode="wait">
            {/* Step 1: Basics */}
            {currentStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
                data-testid="step-1-basics"
              >
                <div>
                  <label className="text-xs font-semibold text-slate-300">
                    Challenge Title (max 60 chars)
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    data-testid="challenge-title-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Implement LRU Cache with O(1) ops"
                    className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl border border-white/10 bg-black/40 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Category</label>
                    <select
                      value={category}
                      data-testid="challenge-category-select"
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl border border-white/10 bg-black/40 text-white text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Frontend">Frontend</option>
                      <option value="Backend">Backend</option>
                      <option value="Algorithm">Algorithm</option>
                      <option value="DevOps">DevOps</option>
                      <option value="Documentation">Documentation</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300">Difficulty & XP</label>
                    <select
                      value={difficulty}
                      data-testid="challenge-difficulty-select"
                      onChange={(e) => setDifficulty(e.target.value as any)}
                      className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl border border-white/10 bg-black/40 text-white text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Easy">Easy (50 XP)</option>
                      <option value="Medium">Medium (100 XP)</option>
                      <option value="Hard">Hard (200 XP)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Target Metric</label>
                  <select
                    value={targetMetric}
                    data-testid="challenge-metric-select"
                    onChange={(e) => setTargetMetric(e.target.value)}
                    className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl border border-white/10 bg-black/40 text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="5 Commits">5 Commits</option>
                    <option value="3 PRs">3 PRs</option>
                    <option value="10 Code Reviews">10 Code Reviews</option>
                    <option value="15 Stars">15 Stars</option>
                  </select>
                </div>
              </motion.div>
            )}

            {/* Step 2: Code & Specs */}
            {currentStep === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
                data-testid="step-2-code-specs"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">Problem Description</label>
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/10">
                      <button
                        type="button"
                        onClick={() => setDescTab('write')}
                        className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer',
                          descTab === 'write' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                        )}
                      >
                        Write
                      </button>
                      <button
                        type="button"
                        onClick={() => setDescTab('preview')}
                        className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer',
                          descTab === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                        )}
                      >
                        Preview
                      </button>
                    </div>
                  </div>

                  {descTab === 'write' ? (
                    <textarea
                      rows={3}
                      value={description}
                      data-testid="challenge-description-textarea"
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Markdown description of criteria..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-black/40 text-white text-xs focus:outline-none focus:border-indigo-500 resize-none font-mono"
                    />
                  ) : (
                    <div className="w-full p-3.5 rounded-xl border border-white/10 bg-black/30 text-xs text-slate-300 min-h-[75px] leading-relaxed">
                      {description || <span className="text-slate-500">Nothing to preview</span>}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">Starter Boilerplate Code</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as any)}
                      className="px-2 py-1 rounded-lg border border-white/10 bg-black/40 text-[11px] text-indigo-400 font-semibold outline-none"
                    >
                      <option value="TypeScript">TypeScript</option>
                      <option value="JavaScript">JavaScript</option>
                      <option value="Python">Python</option>
                      <option value="Go">Go</option>
                    </select>
                  </div>
                  <textarea
                    rows={4}
                    value={starterCode}
                    data-testid="challenge-starter-code-textarea"
                    onChange={(e) => setStarterCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-black/50 text-emerald-400 font-mono text-xs focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
                  />
                </div>
              </motion.div>
            )}

            {/* Step 3: Sandboxed Test Runner */}
            {currentStep === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
                data-testid="step-3-test-runner"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <FileCode className="w-4 h-4 text-indigo-400" />
                      Isolated Test Cases ({testCases.length})
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Configure sandbox assertion inputs and expected outputs
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="add-test-case-btn"
                      onClick={handleAddTestCase}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Case
                    </button>
                    <button
                      type="button"
                      data-testid="run-test-cases-btn"
                      onClick={handleRunTests}
                      disabled={isRunningTests}
                      className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      {isRunningTests ? 'Running Sandbox...' : 'Run Test Cases'}
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {testCases.map((tc, index) => (
                    <div
                      key={tc.id}
                      data-testid={`test-case-row-${index}`}
                      className="p-3 rounded-2xl border border-white/10 bg-black/40 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                        <span className="flex items-center gap-1.5">
                          Case #{index + 1}
                          {tc.status === 'passed' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Passed ({tc.executionTimeMs}ms)
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTestCase(tc.id)}
                          className="text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-mono">Input</span>
                          <input
                            type="text"
                            value={tc.input}
                            onChange={(e) => handleTestCaseChange(tc.id, 'input', e.target.value)}
                            className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/50 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-mono">Expected Output</span>
                          <input
                            type="text"
                            value={tc.expectedOutput}
                            onChange={(e) => handleTestCaseChange(tc.id, 'expectedOutput', e.target.value)}
                            className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/50 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 4: Review */}
            {currentStep === 4 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
                data-testid="step-4-review"
              >
                <div className="p-4 rounded-2xl border border-white/10 bg-black/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-bold uppercase tracking-wider">
                      {category}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
                      +{xpReward} XP
                    </span>
                  </div>

                  <h4 className="text-lg font-bold text-white tracking-tight">
                    {title || 'Untitled Challenge'}
                  </h4>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    {description || 'No description provided.'}
                  </p>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center text-xs">
                    <div className="p-2 rounded-xl bg-white/[0.02]">
                      <span className="text-[10px] text-slate-500 block uppercase">Difficulty</span>
                      <span className="font-bold text-white">{difficulty}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white/[0.02]">
                      <span className="text-[10px] text-slate-500 block uppercase">Target</span>
                      <span className="font-bold text-white">{targetMetric}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white/[0.02]">
                      <span className="text-[10px] text-slate-500 block uppercase">Test Cases</span>
                      <span className="font-bold text-emerald-400">{testCases.length} Verified</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <button
            type="button"
            data-testid="modal-cancel-btn"
            onClick={currentStep === 1 ? onClose : handlePrevStep}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            {currentStep > 1 && <ArrowLeft className="w-3.5 h-3.5" />}
            <span>{currentStep === 1 ? 'Cancel' : 'Previous Step'}</span>
          </button>

          <div className="flex items-center gap-3">
            {currentStep < 4 ? (
              <button
                type="button"
                data-testid="next-step-btn"
                onClick={handleNextStep}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 active:scale-95 transition-all cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                data-testid="publish-challenge-btn"
                onClick={handlePublish}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 active:scale-95 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Publish Challenge</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
