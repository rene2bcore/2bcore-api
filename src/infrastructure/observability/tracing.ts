import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { env } from '../../shared/config/env.js';
import { logger } from './logger.js';

let sdk: NodeSDK | null = null;

export function initTracing(): void {
  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: env.OTEL_SERVICE_NAME,
    [SEMRESATTRS_SERVICE_VERSION]: env.OTEL_SERVICE_VERSION,
  });

  const metricsExporter = new PrometheusExporter(
    { port: env.OTEL_METRICS_PORT },
    () => logger.info({ port: env.OTEL_METRICS_PORT }, 'Prometheus metrics available'),
  );

  // Use OTLP exporter when endpoint is configured; fall back to ConsoleSpanExporter in dev
  const traceExporter = env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? new OTLPTraceExporter({ url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces` })
    : new ConsoleSpanExporter();

  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader: metricsExporter,
    instrumentations: [
      new HttpInstrumentation(),
      new FastifyInstrumentation(),
      new PrismaInstrumentation(),
    ],
  });

  sdk.start();
  logger.info({ service: env.OTEL_SERVICE_NAME }, 'OpenTelemetry tracing initialized');
}

export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    logger.info('OpenTelemetry SDK shut down');
  }
}
