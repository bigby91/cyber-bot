let queue = Promise.resolve();

const enqueue = (fn) => {
  const result = queue.then(() => fn());
  queue = result.catch(() => {});
  return result;
};

module.exports = { enqueue };
