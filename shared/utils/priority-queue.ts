const h_top = 0;
const h_parent = (i) => ((i + 1) >>> 1) - 1;
const left = (i) => (i << 1) + 1;
const right = (i) => (i + 1) << 1;

export class PriorityQueue<T> {
  private heap: T[] = [];
  private comparator: Function;
  constructor(comparator = (a: T, b: T) => a > b) {
    this.comparator = comparator;
  }
  size() {
    return this.heap.length;
  }
  isEmpty() {
    return this.size() == 0;
  }
  peek() {
    return this.heap[h_top];
  }
  push(...values) {
    values.forEach((value) => {
      this.heap.push(value);
      this.siftUp();
    });
    return this.size();
  }
  pop() {
    const poppedValue = this.peek();
    const bottom = this.size() - 1;
    if (bottom > h_top) {
      this.swap(h_top, bottom);
    }
    this.heap.pop();
    this.siftDown();
    return poppedValue;
  }
  replace(value) {
    const replacedValue = this.peek();
    this.heap[h_top] = value;
    this.siftDown();
    return replacedValue;
  }
  private greater(i, j) {
    return this.comparator(this.heap[i], this.heap[j]);
  }
  private swap(i, j) {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }
  private siftUp() {
    let node = this.size() - 1;
    while (node > h_top && this.greater(node, h_parent(node))) {
      this.swap(node, h_parent(node));
      node = h_parent(node);
    }
  }
  private siftDown() {
    let node = h_top;
    while (
      (left(node) < this.size() && this.greater(left(node), node)) ||
      (right(node) < this.size() && this.greater(right(node), node))
    ) {
      let maxChild =
        right(node) < this.size() && this.greater(right(node), left(node))
          ? right(node)
          : left(node);
      this.swap(node, maxChild);
      node = maxChild;
    }
  }
}
