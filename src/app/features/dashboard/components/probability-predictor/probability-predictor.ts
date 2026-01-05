import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, NgZone, signal } from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { LotteryResult } from '../../models/lottery';
import { InteractionService } from '../../services/interaction.service';


@Component({
    selector: 'app-probability-predictor',
    standalone: true,
    imports: [CommonModule, ScrollingModule],
    templateUrl: './probability-predictor.html',
    styleUrls: ['./probability-predictor.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProbabilityPredictor {
    history = input<LotteryResult[]>([]);
    product = input<'645' | '655'>('645');

    isLoading = signal<boolean>(false);
    predictionResults = signal<any[]>([]);
    bookmarks = signal<string[]>(JSON.parse(localStorage.getItem('lottery_bookmarks') || '[]'));

    constructor(private interactionService: InteractionService, private ngZone: NgZone) { }

    // Virtual Scroll configuration

    itemSize = 120; // Height of each row

    maxNumber = computed(() => this.product() === '645' ? 45 : 55);

    // Main calculation logic
    generateProbabilitySets() {
        const data = this.history();
        if (!data || data.length === 0) return;

        this.isLoading.set(true);

        // Simulating heavy calculation
        this.ngZone.runOutsideAngular(() => {
            setTimeout(() => {
                const maxNum = this.maxNumber();
                const latestDraw = this.parseNumbers(data[0].result);
                const historySets = data.map(d => new Set(this.parseNumbers(d.result)));

                // 1. Calculate stats for each number
                const stats = new Map<number, { count: number, lastSeen: number, prob: number }>();
                for (let i = 1; i <= maxNum; i++) {
                    stats.set(i, { count: 0, lastSeen: -1, prob: 0 });
                }

                data.forEach((draw, index) => {
                    const nums = this.parseNumbers(draw.result);
                    nums.forEach(n => {
                        const s = stats.get(n);
                        if (s) {
                            s.count++;
                            if (s.lastSeen === -1) s.lastSeen = index;
                        }
                    });
                });

                const totalDraws = data.length;
                stats.forEach(s => {
                    s.prob = (s.count / totalDraws) * 100;
                });

                // 2. Filter pool: Remove numbers from latest draw
                const pool = Array.from({ length: maxNum }, (_, i) => i + 1)
                    .filter(n => !latestDraw.includes(n));

                // 3. Generate candidate combinations
                // We'll generate a diverse set of combinations based on probability + gaps
                const results: { numbers: number[], score: number, avgProb: number, maxGap: number }[] = [];
                const iterations = 500; // Generate 500 potential sets

                for (let i = 0; i < iterations; i++) {
                    const combination = this.pickCombination(pool, stats);
                    const comboKey = combination.sort((a, b) => a - b).join(',');

                    // Only keep if this exact combination has NEVER appeared in history
                    const hasAppeared = historySets.some(set =>
                        combination.every(num => set.has(num))
                    );

                    if (!hasAppeared) {
                        const avgProb = combination.reduce((acc, n) => acc + (stats.get(n)?.prob || 0), 0) / 6;
                        const maxGap = Math.max(...combination.map(n => stats.get(n)?.lastSeen || 0));

                        results.push({
                            numbers: combination.sort((a, b) => a - b),
                            score: (avgProb * 0.7) + (maxGap * 0.3), // Weighting probability and "ripeness"
                            avgProb,
                            maxGap
                        });
                    }
                }

                // Bring UI updates back into Angular Zone
                this.ngZone.run(() => {
                    this.predictionResults.set(results.sort((a, b) => b.score - a.score));
                    this.isLoading.set(false);
                });
            }, 800);
        });
    }

    private pickCombination(pool: number[], stats: Map<number, any>): number[] {
        const result: number[] = [];
        const tempPool = [...pool];

        while (result.length < 6 && tempPool.length > 0) {
            // Weighted random selection based on historical probability
            const totalWeight = tempPool.reduce((acc, n) => acc + (stats.get(n)?.prob || 1), 0);
            let random = Math.random() * totalWeight;

            for (let i = 0; i < tempPool.length; i++) {
                const n = tempPool[i];
                const weight = stats.get(n)?.prob || 1;
                if (random < weight) {
                    result.push(n);
                    tempPool.splice(i, 1);
                    break;
                }
                random -= weight;
            }
        }
        return result;
    }

    private parseNumbers(resultStr: string): number[] {
        return resultStr.split(/[,-]/)
            .map(s => Number(s.trim()))
            .filter(n => !isNaN(n))
            .slice(0, 6); // Only main 6 numbers
    }

    getBallColor(num: number): string {
        if (num <= 10) return 'bg-yellow-500 shadow-yellow-500/50';
        if (num <= 20) return 'bg-blue-500 shadow-blue-500/50';
        if (num <= 30) return 'bg-red-500 shadow-red-500/50';
        if (num <= 40) return 'bg-green-500 shadow-green-500/50';
        return 'bg-purple-500 shadow-purple-500/50';
    }

    trackByFn(index: number, item: any) {
        return item.numbers.join(',');
    }

    // New Interaction Features
    copyNumbers(numbers: number[]) {
        const text = numbers.map(n => n < 10 ? '0' + n : n).join(', ');
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard: ' + text);
    }

    toggleBookmark(numbers: number[]) {
        const key = numbers.join(',');
        const current = this.bookmarks();
        let updated;
        if (current.includes(key)) {
            updated = current.filter(k => k !== key);
        } else {
            updated = [...current, key];
        }
        this.bookmarks.set(updated);
        localStorage.setItem('lottery_bookmarks', JSON.stringify(updated));
    }

    isBookmarked(numbers: number[]): boolean {
        return this.bookmarks().includes(numbers.join(','));
    }

    sendToChecker(numbers: number[]) {
        this.interactionService.sendToChecker(numbers);
    }
}

