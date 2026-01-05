import { CommonModule } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';

@Component({
    selector: 'app-lucky-numbers',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './lucky-numbers.html',
    styles: [`
    .lucky-card {
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      position: relative;
      overflow: hidden;
    }
    .lucky-card::after {
      content: '';
      position: absolute;
      top: -20%;
      right: -10%;
      width: 200px;
      height: 200px;
      background: radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%);
      pointer-events: none;
    }
  `]
})
export class LuckyNumbers {
    product = input<'645' | '655'>('645');
    termId = input<string | number | undefined | null>(null);

    luckyNumbers = computed(() => {
        const p = this.product();
        const tid = this.termId();
        const today = new Date();

        // Base seed from date YYYYMMDD
        let seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

        // If term ID is present, mix it into the seed for product-specific variance
        if (tid) {
            const termNum = Number(tid);
            if (!isNaN(termNum)) {
                seed = seed ^ termNum; // XOR mix
            }
        }

        return this.generateDeterministicNumbers(seed, p === '645' ? 45 : 55, p === '645' ? 6 : 7);
    });

    private generateDeterministicNumbers(seed: number, max: number, count: number): number[] {
        const results: number[] = [];
        let currentSeed = seed;

        const pseudoRandom = () => {
            currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
            return currentSeed / 4294967296;
        };

        while (results.length < count) {
            const num = Math.floor(pseudoRandom() * max) + 1;
            if (!results.includes(num)) {
                results.push(num);
            }
        }

        return results.sort((a, b) => a - b);
    }

    getBallColor(num: number): string {
        if (num <= 10) return 'bg-yellow-500 shadow-yellow-500/50';
        if (num <= 20) return 'bg-blue-500 shadow-blue-500/50';
        if (num <= 30) return 'bg-red-500 shadow-red-500/50';
        if (num <= 40) return 'bg-green-500 shadow-green-500/50';
        return 'bg-purple-500 shadow-purple-500/50';
    }
}
