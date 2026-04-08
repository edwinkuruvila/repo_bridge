let automaticOperationQueue = Promise.resolve();

export function enqueueAutomaticOperation(
  operation: () => Promise<void>,
): void {
  automaticOperationQueue = automaticOperationQueue.then(operation, operation);
}
