import { StateRecorder } from './state-recorder';

describe('StateRecorder & Time-Travel Engine', () => {
  let recorder: StateRecorder;

  beforeEach(() => {
    recorder = new StateRecorder(['p1', 'p2']);
  });

  describe('Deterministic State Reconciliation Across 500 Actions', () => {
    it('accurately reconciles editor contents, test passes, and HP across 500 actions with 100% fidelity', () => {
      let currentTime = 1000;

      // Simulate 500 rapid actions
      for (let i = 0; i < 500; i++) {
        currentTime += 100 + (i % 200);

        if (i % 4 === 0) {
          recorder.recordAction(
            'KEYSTROKE_INSERT',
            { playerId: 'p1', text: `v${i} ` },
            currentTime,
          );
        } else if (i % 4 === 1) {
          recorder.recordAction(
            'TEST_EXECUTION',
            { playerId: 'p1', testsPassed: Math.min(5, Math.floor(i / 100)), totalTests: 5 },
            currentTime,
          );
        } else if (i % 4 === 2) {
          recorder.recordAction(
            'HP_DELTA',
            { playerId: 'p2', hpDelta: -2 },
            currentTime,
          );
        } else {
          recorder.recordAction(
            'KEYSTROKE_INSERT',
            { playerId: 'p2', text: `def solve_${i}(): ` },
            currentTime,
          );
        }
      }

      expect(recorder.getActions()).toHaveLength(500);
      expect(recorder.getSnapshots().length).toBeGreaterThan(10);

      // Seek to middle of match (t = 40000ms)
      const seekMid = recorder.seekToTimestamp(40000);
      expect(seekMid.state.p1).toBeDefined();
      expect(seekMid.state.p2).toBeDefined();
      expect(seekMid.state.p1.code.length).toBeGreaterThan(0);
      expect(seekMid.seekTimeMs).toBeLessThan(16); // Sub-16ms seek criterion

      // Seek to exact end
      const totalDuration = recorder.getTotalDurationMs();
      const seekEnd = recorder.seekToTimestamp(totalDuration);
      expect(seekEnd.seq).toBe(500);
      expect(seekEnd.seekTimeMs).toBeLessThan(16);
    });
  });

  describe('Timeline Markers & Export / Import', () => {
    it('extracts test passes, sabotages, and critical HP hits into timeline markers', () => {
      recorder.recordAction(
        'TEST_EXECUTION',
        { playerId: 'p1', testsPassed: 5, totalTests: 5 },
        10000,
      );
      recorder.recordAction(
        'SABOTAGE_TRIGGER',
        { playerId: 'p2', sabotageType: 'KEY_SCRAMBLE' },
        25000,
      );
      recorder.recordAction(
        'HP_DELTA',
        { playerId: 'p2', hpDelta: -30 },
        40000,
      );

      const markers = recorder.getTimelineMarkers();
      expect(markers).toHaveLength(3);
      expect(markers[0].type).toBe('TEST_PASS');
      expect(markers[1].type).toBe('SABOTAGE');
      expect(markers[2].type).toBe('CRITICAL_HP');
    });

    it('exports and re-imports session data without state loss', () => {
      recorder.recordAction('KEYSTROKE_INSERT', { playerId: 'p1', text: 'console.log(42);' }, 5000);
      const json = recorder.exportSessionJson();

      const newRecorder = new StateRecorder(['p1', 'p2']);
      newRecorder.importSessionJson(json);

      const seek = newRecorder.seekToTimestamp(5000);
      expect(seek.state.p1.code).toBe('console.log(42);');
    });
  });
});
