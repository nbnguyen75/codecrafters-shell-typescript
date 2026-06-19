export class TrieNode {
   children: Map<string, TrieNode>;
   isEndOfWord: boolean;

   constructor() {
      this.children = new Map();
      this.isEndOfWord = false;
   }
}

export class Trie {
   root: TrieNode;

   constructor() {
      this.root = new TrieNode();
   }

   private _insert(word: string) {
      let current: TrieNode | undefined = this.root;

      for (const char of word) {
         if (!current?.children.has(char)) {
            current?.children.set(char, new TrieNode())
         }

         current = current?.children.get(char)
      }

      if (current) {
         current.isEndOfWord = true;
      }
   }

   insert(...words: string[]) {
      for (const word of words) {
         this._insert(word);
      }
   }

   private collectWords(node: TrieNode, prefix: string, results: string[]) {
      if (node.isEndOfWord) {
         results.push(prefix);
      }

      for (const [char, child] of node.children) {
         this.collectWords(child, prefix + char, results);
      }
   }

   findWordsWithPrefix(prefix: string): string[] {
      let current: TrieNode | undefined = this.root;

      for (const char of prefix) {
         if (!current?.children.has(char)) {
            return [];
         }
         current = current.children.get(char);
      }

      const results: string[] = [];
      this.collectWords(current!, prefix, results);

      return results;
   }

   findCommonPrefix(prefix: string): string {
      const words = this.findWordsWithPrefix(prefix);
      if (words.length === 0) return prefix;

      let lcp = words[0];
      for (let i = 1; i < words.length; i++) {
         let j = 0;
         while (j < lcp.length && j < words[i].length && lcp[j] === words[i][j]) {
            j++;
         }
         lcp = lcp.slice(0, j);
      }

      return lcp;
   }

   startsWith(prefix: string): boolean {
      let current: TrieNode | undefined = this.root

      for (const char of prefix) {
         if (!current?.children.has(char)) {
            return false
         }

         current = current.children.get(char)
      }

      return true;
   }
}