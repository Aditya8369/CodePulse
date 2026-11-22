import * as k8s from "@kubernetes/client-node";
import { describe, it, expect, beforeEach } from "vitest";
import {
  RunnerOperator,
  RunnerPoolCustomResource,
  IKubernetesClientWrapper,
  GrpcHealthProbeResult,
} from "./k8s-runner-operator";

class MockKubernetesClient implements IKubernetesClientWrapper {
  public pods: Map<string, k8s.V1Pod> = new Map();
  public deletedPods: Array<{ name: string; gracePeriod: number }> = [];
  public createdPods: k8s.V1Pod[] = [];
  public updatedStatus: unknown = null;
  public probeResponses: Map<string, GrpcHealthProbeResult> = new Map();

  listPods(): Promise<k8s.V1PodList> {
    const podList: k8s.V1PodList = {
      apiVersion: "v1",
      kind: "PodList",
      metadata: {},
      items: Array.from(this.pods.values()),
    };
    return Promise.resolve(podList);
  }

  createPod(_namespace: string, pod: k8s.V1Pod): Promise<k8s.V1Pod> {
    const podName = pod.metadata?.name || "test-pod";
    this.pods.set(podName, pod);
    this.createdPods.push(pod);
    return Promise.resolve(pod);
  }

  deletePod(
    _namespace: string,
    podName: string,
    gracePeriodSeconds = 0,
  ): Promise<void> {
    this.pods.delete(podName);
    this.deletedPods.push({ name: podName, gracePeriod: gracePeriodSeconds });
    return Promise.resolve();
  }

  updateCustomResourceStatus(
    _group: string,
    _version: string,
    _namespace: string,
    _plural: string,
    _name: string,
    status: any,
  ): Promise<void> {
    this.updatedStatus = status;
    return Promise.resolve();
  }

  probeGrpcHealth(podIp: string): Promise<GrpcHealthProbeResult> {
    if (this.probeResponses.has(podIp)) {
      return Promise.resolve(this.probeResponses.get(podIp)!);
    }
    return Promise.resolve({
      healthy: true,
      cpuPercent: 15.0,
      memoryPercent: 20.0,
      zombieProcesses: 0,
      activeExecutions: 0,
      diskFull: false,
    });
  }
}

describe("RunnerOperator Vitest Test Suite", () => {
  let mockClient: MockKubernetesClient;
  let operator: RunnerOperator;
  let sampleCRD: RunnerPoolCustomResource;

  beforeEach(() => {
    mockClient = new MockKubernetesClient();
    operator = new RunnerOperator(mockClient, "codepulse-runners");

    sampleCRD = {
      apiVersion: "codepulse.io/v1alpha1",
      kind: "RunnerPool",
      metadata: {
        name: "tournament-pool",
        namespace: "codepulse-runners",
      },
      spec: {
        minRunners: 3,
        maxRunners: 10,
        runnerImage: "ghcr.io/codepulse/runner-sandbox:latest",
        targetQueueWaitSeconds: 3.0,
        healthThresholds: {
          cpuThresholdPercent: 95.0,
          memoryThresholdPercent: 95.0,
          sustainedThresholdSeconds: 30,
          executionTimeoutSeconds: 15,
        },
      },
    };
  });

  describe("Reconciliation & Initial Pod Provisioning", () => {
    it("should provision minRunners when pool is empty", async () => {
      const status = await operator.reconcile(sampleCRD, 0);

      expect(status).toBeDefined();
      expect(status.currentRunners).toBe(3);
      expect(status.readyRunners).toBe(3);
      expect(mockClient.createdPods.length).toBe(3);
      expect(status.phase).toBe("Ready");
    });
  });

  describe("Degraded Pod Detection & Self-Healing", () => {
    it("should terminate and replace zombie compiler pods hanging beyond execution timeout", async () => {
      const zombiePod: k8s.V1Pod = {
        metadata: { name: "runner-zombie-1" },
        status: { phase: "Running", podIP: "10.244.0.5" },
      };
      mockClient.pods.set("runner-zombie-1", zombiePod);

      mockClient.probeResponses.set("10.244.0.5", {
        healthy: false,
        cpuPercent: 50.0,
        memoryPercent: 40.0,
        zombieProcesses: 2,
        activeExecutions: 1,
        executionAgeSeconds: 25,
        diskFull: false,
      });

      const status = await operator.reconcile(sampleCRD, 0);

      expect(mockClient.deletedPods.some((p) => p.name === "runner-zombie-1")).toBe(true);
      expect(status.restartedRunnersTotal).toBe(1);
      expect(status.phase).toBe("Healing");
      expect(status.mttrSeconds).toBeLessThan(10);
    });

    it("should evict pods sustaining >95% CPU/Memory threshold for 30s", async () => {
      const saturatedPod: k8s.V1Pod = {
        metadata: { name: "runner-saturated-1" },
        status: { phase: "Running", podIP: "10.244.0.9" },
      };
      mockClient.pods.set("runner-saturated-1", saturatedPod);

      mockClient.probeResponses.set("10.244.0.9", {
        healthy: false,
        cpuPercent: 98.0,
        memoryPercent: 96.0,
        zombieProcesses: 0,
        activeExecutions: 1,
        diskFull: false,
      });

      await operator.reconcile(sampleCRD, 0);
      expect(mockClient.deletedPods.length).toBe(0);

      const origDateNow = Date.now;
      try {
        Date.now = () => origDateNow() + 35000;

        await operator.reconcile(sampleCRD, 0);
        expect(mockClient.deletedPods.some((p) => p.name === "runner-saturated-1")).toBe(true);
      } finally {
        Date.now = origDateNow;
      }
    });
  });

  describe("Dynamic Autoscaling under Battle Queue Pressure", () => {
    it("should autoscale runner pods when queue wait time exceeds 3 seconds", async () => {
      await operator.reconcile(sampleCRD, 0);
      expect(mockClient.pods.size).toBe(3);

      const scaledStatus = await operator.reconcile(sampleCRD, 4.5);

      expect(scaledStatus.phase).toBe("Scaling");
      expect(scaledStatus.currentRunners).toBeGreaterThan(3);
      expect(scaledStatus.currentRunners).toBeLessThanOrEqual(10);
      expect(scaledStatus.lastAutoscaleTime).toBeDefined();
    });
  });

  describe("Prometheus Metrics Export", () => {
    it("should output Prometheus format metrics tracking capacity, restarts, and MTTR", async () => {
      const status = await operator.reconcile(sampleCRD, 0);
      const metrics = operator.getPrometheusMetrics(status);

      expect(metrics).toContain("codepulse_runner_pool_capacity 3");
      expect(metrics).toContain("codepulse_runner_pool_ready_runners 3");
      expect(metrics).toContain("codepulse_runner_pool_restarts_total");
      expect(metrics).toContain("codepulse_runner_pool_mttr_seconds");
    });
  });
});
