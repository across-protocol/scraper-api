import { ethers } from "ethers";
import { queue, QueueObject } from "async";

// The async/queue library has a task-based interface for building a concurrent queue.
// This is the type we pass to define a request "task".
interface RateLimitTask {
  // These are the arguments to be passed to super.send().
  sendArgs: [string, Array<any>];

  // These are the promise callbacks that will cause the initial send call made by the user to either return a result
  // or fail.
  resolve: (result: any) => void;
  reject: (err: any) => void;
}

// This provider is a very small addition to the JsonRpcProvider that ensures that no more than `maxConcurrency`
// requests are ever in flight. It uses the async/queue library to manage this.
export class RateLimitedProvider extends ethers.providers.JsonRpcProvider {
  // The queue object that manages the tasks.
  private queue: QueueObject<RateLimitTask>;

  // Takes the same arguments as the JsonRpcProvider, but it has an additional maxConcurrency value at the beginning
  // of the list.
  constructor(
    maxConcurrency: number,
    ...jsonRpcConstructorParams: ConstructorParameters<typeof ethers.providers.JsonRpcProvider>
  ) {
    super(...jsonRpcConstructorParams);

    // This sets up the queue. Each task is executed by calling the superclass's send method, which fires off the
    // request. This queue sends out requests concurrently, but stops once the concurrency limit is reached. The
    // maxConcurrency is configured here.
    this.queue = queue(async ({ sendArgs, resolve, reject }: RateLimitTask) => {
      await super
        .send(...sendArgs)
        .then(resolve)
        .catch(reject);
    }, maxConcurrency);
  }

  override async send(method: string, params: Array<any>): Promise<any> {
    // This simply creates a promise and adds the arguments and resolve and reject handlers to the task.
    return new Promise<any>((resolve, reject) => {
      const task: RateLimitTask = {
        sendArgs: [method, params],
        resolve,
        reject,
      };
      this.queue.push(task);
    });
  }
}
