class QueueNode<T> {
  public next: QueueNode<T> | null = null;

  constructor(public value: T) {}
}

export class Queue<T> {
  private head: QueueNode<T> | null = null;
  private tail: QueueNode<T> | null = null;
  private _size = 0;

  public enqueue(value: T): void {
    const node = new QueueNode(value);

    if (this.tail === null) {
      this.head = node;
      this.tail = node;
    } else {
      this.tail.next = node;
      this.tail = node;
    }

    this._size++;
  }

  public dequeue(): T | undefined {
    if (this.head === null) {
      return undefined;
    }

    const value = this.head.value;
    this.head = this.head.next;

    if (this.head === null) {
      this.tail = null;
    }

    this._size--;
    return value;
  }

  public peek(): T | undefined {
    if (this.head === null) {
      return undefined;
    }

    return this.head.value;
  }

  public get size(): number {
    return this._size;
  }

  public clear(): void {
    this.head = null;
    this.tail = null;
    this._size = 0;
  }

  public toArray(): T[] {
    const result: T[] = [];
    let current = this.head;

    while (current !== null) {
      result.push(current.value);
      current = current.next;
    }

    return result;
  }
}
