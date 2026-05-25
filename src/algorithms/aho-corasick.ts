import type { MatchResult } from '../types';

interface AhoCorasickNode {
  children: Map<string, AhoCorasickNode>;
  failure: AhoCorasickNode | null;
  output: string[];
  id: number;
}

function createNode(id: number): AhoCorasickNode {
  return { children: new Map(), failure: null, output: [], id };
}

export class AhoCorasick {
  private root: AhoCorasickNode;
  private nodeCount = 0;
  private built = false;

  constructor() { this.root = createNode(this.nodeCount++); }

  addPattern(pattern: string): void {
    const p = pattern.toLowerCase();
    let curr = this.root;
    for (const ch of p) {
      if (!curr.children.has(ch)) curr.children.set(ch, createNode(this.nodeCount++));
      curr = curr.children.get(ch)!;
    }
    curr.output.push(pattern);
    this.built = false;
  }

  build(): void {
    const queue: AhoCorasickNode[] = [];
    this.root.failure = this.root;
    for (const [, child] of this.root.children) { child.failure = this.root; queue.push(child); }
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const [ch, child] of curr.children) {
        let failure = curr.failure!;
        while (failure !== this.root && !failure.children.has(ch)) failure = failure.failure!;
        child.failure = failure.children.get(ch) ?? this.root;
        if (child.failure === child) child.failure = this.root;
        child.output = [...child.output, ...child.failure.output];
        queue.push(child);
      }
    }
    this.built = true;
  }

  search(text: string): Map<string, number[]> {
    if (!this.built) this.build();
    const result = new Map<string, number[]>();
    const textLC = text.toLowerCase();
    let curr = this.root;

    for (let i = 0; i < textLC.length; i++) {
      const ch = textLC[i];
      while (curr !== this.root && !curr.children.has(ch)) curr = curr.failure!;
      if (curr.children.has(ch)) curr = curr.children.get(ch)!;
      for (const kw of curr.output) {
        const startPos = i - kw.length + 1;
        if (!result.has(kw)) result.set(kw, []);
        result.get(kw)!.push(startPos);
      }
    }
    return result;
  }
}

export function runAhoCorasick(text: string, keywords: string[]): Map<string, MatchResult> {
  const start = performance.now();
  const ac = new AhoCorasick();
  for (const kw of keywords) ac.addPattern(kw);
  ac.build();
  const searchResult = ac.search(text);
  const totalTime = performance.now() - start;

  const results = new Map<string, MatchResult>();
  for (const [kw, positions] of searchResult) {
    if (positions.length > 0)
      results.set(kw, { keyword: kw, algorithm: 'AhoCorasick', positions, count: positions.length, executionTimeMs: totalTime });
  }
  return results;
}
