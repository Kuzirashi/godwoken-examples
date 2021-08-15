export const logger = {
    debug: (...args: any[]) => {
      if (process.env.DEBUG) {
        console.debug(...args);
      }
    }
  }