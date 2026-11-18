import { TraceInterceptor } from './trace.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';

describe('TraceInterceptor Suite', () => {
  let interceptor: TraceInterceptor;

  beforeEach(() => {
    interceptor = new TraceInterceptor();
  });

  describe('HTTP Interception', () => {
    it('should extract incoming traceparent header and inject response headers', async () => {
      const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
      const spanId = '00f067aa0ba902b7';
      const incomingTraceparent = `00-${traceId}-${spanId}-01`;

      const responseHeaders: Record<string, string> = {};
      const req: any = {
        method: 'POST',
        path: '/battles/submit',
        url: '/api/v1/battles/submit',
        headers: {
          traceparent: incomingTraceparent,
        },
      };

      const res: any = {
        statusCode: 200,
        setHeader: jest.fn((key: string, value: string) => {
          responseHeaders[key] = value;
        }),
      };

      const mockContext: ExecutionContext = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => res,
        }),
      } as any;

      const mockCallHandler: CallHandler = {
        handle: () => of({ success: true, submissionId: 'sub-1' }),
      };

      const resultObservable = interceptor.intercept(mockContext, mockCallHandler);
      let outputData: any;
      await new Promise<void>((resolve, reject) => {
        resultObservable.subscribe({
          next: (val) => {
            outputData = val;
          },
          complete: () => resolve(),
          error: reject,
        });
      });

      expect(outputData).toEqual({ success: true, submissionId: 'sub-1' });
      expect(res.setHeader).toHaveBeenCalledWith('traceparent', expect.stringContaining(traceId));
      expect(res.setHeader).toHaveBeenCalledWith('x-trace-id', traceId);
      expect(req.traceId).toBe(traceId);
    });

    it('should capture errors, record traceId, and rethrow correctly', async () => {
      const responseHeaders: Record<string, string> = {};
      const req: any = {
        method: 'GET',
        path: '/users/profile',
        url: '/api/v1/users/profile',
        headers: {},
      };

      const res: any = {
        statusCode: 500,
        setHeader: jest.fn((key: string, value: string) => {
          responseHeaders[key] = value;
        }),
      };

      const mockContext: ExecutionContext = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => res,
        }),
      } as any;

      const mockCallHandler: CallHandler = {
        handle: () => throwError(() => new Error('Database connection failed')),
      };

      const resultObservable = interceptor.intercept(mockContext, mockCallHandler);

      await expect(
        new Promise((resolve, reject) => {
          resultObservable.subscribe({
            next: resolve,
            error: reject,
          });
        }),
      ).rejects.toThrow('Database connection failed');

      expect(req.traceId).toBeDefined();
    });
  });

  describe('WebSocket Interception', () => {
    it('should extract trace context from websocket handshake headers', async () => {
      const traceId = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
      const spanId = '1234567890abcdef';
      const incomingTraceparent = `00-${traceId}-${spanId}-01`;

      const mockSocket: any = {
        id: 'socket-client-777',
        handshake: {
          headers: {
            traceparent: incomingTraceparent,
          },
        },
      };

      const mockContext: ExecutionContext = {
        getType: () => 'ws',
        switchToWs: () => ({
          getClient: () => mockSocket,
          getData: () => ({ action: 'keystroke' }),
        }),
        getHandler: () => ({ name: 'handleKeystroke' }),
      } as any;

      const mockCallHandler: CallHandler = {
        handle: () => of({ acknowledged: true }),
      };

      const resultObservable = interceptor.intercept(mockContext, mockCallHandler);
      let outputData: any;
      await new Promise<void>((resolve, reject) => {
        resultObservable.subscribe({
          next: (val) => {
            outputData = val;
          },
          complete: () => resolve(),
          error: reject,
        });
      });

      expect(outputData).toEqual({ acknowledged: true });
    });
  });
});
