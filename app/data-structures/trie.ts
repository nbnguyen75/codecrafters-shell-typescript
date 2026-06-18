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

   insert(word: string) {
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
}