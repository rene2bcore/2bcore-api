import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
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

  sdk = new NodeSDK({
    resource,
    ...(env.OTEL_EXPORTER_OTLP_ENDPOINT && {
      traceExporter: new OTLPTraceExporter({
        url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
      }),
    }),
    metricReader: metricsExporter,
    instrumentations: [
      new HttpInstrumentation(),
      new FastifyInstrumentation(),
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
