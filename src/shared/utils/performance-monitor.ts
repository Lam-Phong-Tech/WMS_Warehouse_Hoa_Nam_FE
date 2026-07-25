/**
 * Performance Monitor - Theo dõi các metrics liên quan đến loading performance
 *
 * Metrics tracked:
 * - Chunk load time
 * - API response time
 * - Page render time
 * - User-perceived load time
 */

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

type MetricType = 'chunk_load' | 'api_call' | 'page_render' | 'navigation';

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private enabled: boolean;

  constructor() {
    // Chỉ enable trong development hoặc khi có flag
    this.enabled =
      import.meta.env.DEV ||
      import.meta.env.VITE_ENABLE_PERF_MONITOR === 'true';
  }

  /**
   * Bắt đầu measure một metric
   */
  startMeasure(
    name: string,
    type: MetricType,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.enabled) return;

    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      metadata: {
        type,
        ...metadata,
      },
    };

    this.metrics.set(name, metric);
  }

  /**
   * Kết thúc measure và log kết quả
   */
  endMeasure(name: string, metadata?: Record<string, unknown>): number | null {
    if (!this.enabled) return null;

    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`Performance metric not found: ${name}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;

    metric.endTime = endTime;
    metric.duration = duration;
    metric.metadata = { ...metric.metadata, ...metadata };

    // Log metric
    this.logMetric(metric);

    // Cleanup
    this.metrics.delete(name);

    return duration;
  }

  /**
   * Log metric ra console
   */
  private logMetric(metric: PerformanceMetric): void {
    const { name, duration, metadata } = metric;
    const type = metadata?.type;

    if (!duration) return;

    // Color coding based on performance
    let color = '#52c41a'; // Green - good
    if (duration > 1000)
      color = '#ff4d4f'; // Red - bad
    else if (duration > 500) color = '#faad14'; // Yellow - warning

    console.log(
      `%c[Performance] ${type}: ${name} %c${duration.toFixed(2)}ms`,
      `color: ${color}; font-weight: bold;`,
      'color: #666;',
      metadata || {},
    );
  }

  /**
   * Measure async operation
   */
  async measureAsync<T>(
    name: string,
    type: MetricType,
    operation: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    if (!this.enabled) {
      return operation();
    }

    this.startMeasure(name, type, metadata);
    try {
      const result = await operation();
      this.endMeasure(name, { success: true });
      return result;
    } catch (error) {
      this.endMeasure(name, { success: false, error: String(error) });
      throw error;
    }
  }

  /**
   * Measure sync operation
   */
  measureSync<T>(
    name: string,
    type: MetricType,
    operation: () => T,
    metadata?: Record<string, unknown>,
  ): T {
    if (!this.enabled) {
      return operation();
    }

    this.startMeasure(name, type, metadata);
    try {
      const result = operation();
      this.endMeasure(name, { success: true });
      return result;
    } catch (error) {
      this.endMeasure(name, { success: false, error: String(error) });
      throw error;
    }
  }

  /**
   * Track navigation performance
   */
  trackNavigation(from: string, to: string): void {
    if (!this.enabled) return;

    this.startMeasure(`navigation: ${from} → ${to}`, 'navigation', {
      from,
      to,
    });

    // End measure sau khi page render xong
    requestAnimationFrame(() => {
      setTimeout(() => {
        this.endMeasure(`navigation: ${from} → ${to}`);
      }, 100);
    });
  }

  /**
   * Track chunk load performance
   */
  trackChunkLoad(chunkName: string): () => void {
    if (!this.enabled) {
      return () => {};
    }

    this.startMeasure(`chunk: ${chunkName}`, 'chunk_load', { chunkName });

    return () => {
      this.endMeasure(`chunk: ${chunkName}`);
    };
  }

  /**
   * Track API call performance
   */
  trackApiCall(endpoint: string, method: string): () => void {
    if (!this.enabled) {
      return () => {};
    }

    this.startMeasure(`api: ${method} ${endpoint}`, 'api_call', {
      endpoint,
      method,
    });

    return () => {
      this.endMeasure(`api: ${method} ${endpoint}`);
    };
  }

  /**
   * Get all current metrics
   */
  getMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if monitoring is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Hook để sử dụng performance monitor
 */
export function usePerformanceMonitor() {
  return {
    startMeasure: (
      name: string,
      type: MetricType,
      metadata?: Record<string, unknown>,
    ) => performanceMonitor.startMeasure(name, type, metadata),
    endMeasure: (name: string, metadata?: Record<string, unknown>) =>
      performanceMonitor.endMeasure(name, metadata),
    measureAsync: <T>(
      name: string,
      type: MetricType,
      operation: () => Promise<T>,
      metadata?: Record<string, unknown>,
    ) => performanceMonitor.measureAsync(name, type, operation, metadata),
    measureSync: <T>(
      name: string,
      type: MetricType,
      operation: () => T,
      metadata?: Record<string, unknown>,
    ) => performanceMonitor.measureSync(name, type, operation, metadata),
    trackNavigation: (from: string, to: string) =>
      performanceMonitor.trackNavigation(from, to),
    trackChunkLoad: (chunkName: string) =>
      performanceMonitor.trackChunkLoad(chunkName),
    trackApiCall: (endpoint: string, method: string) =>
      performanceMonitor.trackApiCall(endpoint, method),
  };
}
