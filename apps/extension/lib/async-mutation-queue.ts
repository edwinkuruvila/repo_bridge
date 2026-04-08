export function createAsyncMutationQueue(): <T>(
  operation: () => Promise<T>,
) => Promise<T> {
  let queue = Promise.resolve();

  return <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation, operation);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
