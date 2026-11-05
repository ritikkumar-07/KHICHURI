import { logger, serializeError } from './logger.js';

let errorReporter = null;

export function setErrorReporter(reporter) {
  errorReporter = typeof reporter === 'function' ? reporter : null;
}

export function captureException(error, context = {}) {
  const serialized = serializeError(error);

  logger.error('unhandled_application_error', {
    ...context,
    error: serialized,
  });

  if (!errorReporter) return;

  try {
    const result = errorReporter(error, { ...context, error: serialized });
    if (result && typeof result.catch === 'function') {
      result.catch((reporterError) => {
        logger.warn('error_reporter_failed', {
          error: serializeError(reporterError),
        });
      });
    }
  } catch (reporterError) {
    logger.warn('error_reporter_failed', {
      error: serializeError(reporterError),
    });
  }
}
