import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, OnDestroy, signal } from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { LotteryResult } from '../../models/lottery';

@Component({
    selector: 'app-frequent-groups',
    standalone: true,
    imports: [CommonModule, ScrollingModule],
    templateUrl: './frequent-groups.html',
    styleUrls: ['./frequent-groups.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class FrequentGroups implements OnDestroy {
    private onResizeFn = () => {
        const width = window.innerWidth;
        const newPerRow = width >= 1024 ? 3 : width >= 768 ? 2 : 1;
        if (this.itemsPerRow() !== newPerRow) {
            this.itemsPerRow.set(newPerRow);
        }
    };

    history = input<LotteryResult[]>([]);
    product = input<'645' | '655'>('645');

    groupSize = signal<number>(2);
    selectedNumber = signal<number | null>(null);
    limit = signal<number>(100);
    markedGroups = signal<Set<string>>(new Set());
    isPanelCollapsed = signal<boolean>(false);
    analysisMode = signal<'frequent' | 'next'>('frequent');
    trendFilter = signal<'above' | 'below' | 'all'>('above');
    isLoading = signal<boolean>(false);
    predictiveResults = signal<any[]>([]);
    itemsPerRow = signal<number>(window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1);


    maxNumber = computed(() => this.product() === '645' ? 45 : 55);
    availableNumbers = computed(() => Array.from({ length: this.maxNumber() }, (_, i) => i + 1));

    frequentGroups = computed(() => {
        const data = this.history();
        const size = this.groupSize();
        const targetNum = this.selectedNumber();

        if (!data || data.length === 0 || targetNum === null) return [];

        // Map to store groups: key -> { numbers: number[], draws: {date: string, term: string, timestamp: number}[] }
        const counts = new Map<string, { numbers: number[], draws: { date: string, term: string, timestamp: number, distance?: number }[] }>();

        data.forEach(item => {
            let numbers = item.result.split(/[,-]/)
                .map(s => s.trim())
                .filter(s => s)
                .map(Number);

            // For 6/55, the 7th number in the string is the special number.
            // We must slice BEFORE sorting, otherwise a small special number 
            // will cause the largest main number (like 55) to be sliced off.
            if (this.product() === '655' && numbers.length > 6) {
                numbers = numbers.slice(0, 6);
            }

            numbers.sort((a, b) => a - b);

            if (!numbers.includes(targetNum)) return;
            if (numbers.length < size) return;

            // Filter out the selected number to find combinations from the rest
            const otherNumbers = numbers.filter(n => n !== targetNum);
            const combinations = this.getCombinations(otherNumbers, size - 1);

            combinations.forEach(combo => {
                const fullGroup = [...combo, targetNum].sort((a, b) => a - b);
                const key = fullGroup.join(',');

                if (!counts.has(key)) {
                    counts.set(key, { numbers: fullGroup, draws: [] });
                }

                // Parse "12-12-2024 00:00:00" or simple "12-12-2024"
                const dateParts = item.date.split(' ')[0].split('-');
                const timestamp = new Date(Number(dateParts[2]), Number(dateParts[1]) - 1, Number(dateParts[0])).getTime();

                counts.get(key)!.draws.push({
                    date: item.date.split(' ')[0],
                    term: item.termDate || `#${item.id}`,
                    timestamp
                });
            });
        });

        return Array.from(counts.values())
            .map(group => {
                // Sort draws by timestamp (oldest to newest for distance calc)
                const sortedDraws = group.draws.sort((a, b) => a.timestamp - b.timestamp);

                // Calculate distances
                for (let i = 1; i < sortedDraws.length; i++) {
                    const diffTime = Math.abs(sortedDraws[i].timestamp - sortedDraws[i - 1].timestamp);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    sortedDraws[i].distance = diffDays;
                }

                // Return with newest first for display
                return {
                    ...group,
                    draws: sortedDraws.sort((a, b) => b.timestamp - a.timestamp)
                };
            })
            .filter(group => group.draws.length > 0)
            .sort((a, b) => b.draws.length - a.draws.length)
            .slice(0, this.limit());
    });

    // Dynamic chunking for responsive virtual scroll
    frequentGroupRows = computed(() => {
        const groups = this.frequentGroups();
        const perRow = this.itemsPerRow();
        const rows = [];
        for (let i = 0; i < groups.length; i += perRow) {
            rows.push(groups.slice(i, i + perRow));
        }
        return rows;
    });

    markedList = computed(() => {
        return Array.from(this.markedGroups()).map(key => key.split(',').map(Number));
    });

    globalFrequencies = computed(() => {
        const data = this.history();
        const freqs = new Map<number, number>();
        if (!data.length) return freqs;

        data.forEach(item => {
            const nums = item.result.split(/[,-]/).map(s => Number(s.trim())).filter(n => !isNaN(n));
            nums.forEach(n => freqs.set(n, (freqs.get(n) || 0) + 1));
        });
        return freqs;
    });

    // Track total groups found before limiting
    totalGroupsFound = computed(() => {
        const data = this.history();
        const size = this.groupSize();
        const targetNum = this.selectedNumber();

        if (!data || data.length === 0 || targetNum === null) return 0;

        const counts = new Map<string, number>();

        data.forEach(item => {
            let numbers = item.result.split(/[,-]/)
                .map(s => s.trim())
                .filter(s => s)
                .map(Number);

            // For 6/55, the 7th number in the string is the special number.
            // We must slice BEFORE sorting.
            if (this.product() === '655' && numbers.length > 6) {
                numbers = numbers.slice(0, 6);
            }

            numbers.sort((a, b) => a - b);

            if (!numbers.includes(targetNum)) return;
            if (numbers.length < size) return;

            const otherNumbers = numbers.filter(n => n !== targetNum);
            const combinations = this.getCombinations(otherNumbers, size - 1);

            combinations.forEach(combo => {
                const fullGroup = [...combo, targetNum].sort((a, b) => a - b);
                const key = fullGroup.join(',');
                counts.set(key, (counts.get(key) || 0) + 1);
            });
        });

        return counts.size;
    });


    async runPredictiveAnalysis() {
        const data = this.history();
        const p = this.product();
        const maxNum = p === '645' ? 45 : 55;
        const setSize = p === '645' ? 6 : 7;

        if (!data || data.length < 2) return;

        this.isLoading.set(true);
        this.predictiveResults.set([]);

        // Artificial delay for "processing" feel
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Convert all historical results to sets for fast lookup
        const historySets = data.map(d => {
            const nums = d.result.split(/[,-]/).map(s => Number(s.trim())).filter(n => !isNaN(n));
            return new Set(nums);
        });

        // Calculate frequency of each number appearing in next draws
        const sortedHistory = [...data].sort((a, b) => Number(a.id) - Number(b.id));
        const nextDrawFrequency = new Map<number, number>();

        for (let i = 0; i < sortedHistory.length - 1; i++) {
            const nextNums = sortedHistory[i + 1].result.split(/[,-]/).map(s => Number(s.trim())).filter(n => !isNaN(n));
            nextNums.forEach(num => {
                nextDrawFrequency.set(num, (nextDrawFrequency.get(num) || 0) + 1);
            });
        }

        // Get all numbers sorted by frequency in next draws
        const topNumbers = Array.from(nextDrawFrequency.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([num]) => num);

        // Generate candidate combinations from top numbers
        const candidateSets: number[][] = [];
        const maxCandidates = 100;

        // Generate combinations using top frequent numbers
        const generateCombos = (start: number, current: number[]) => {
            if (current.length === setSize) {
                candidateSets.push([...current]);
                return;
            }
            if (candidateSets.length >= maxCandidates) return;

            for (let i = start; i < topNumbers.length && candidateSets.length < maxCandidates; i++) {
                current.push(topNumbers[i]);
                generateCombos(i + 1, current);
                current.pop();
            }
        };

        generateCombos(0, []);

        // Filter out combinations that have ever appeared in history
        const neverSeenSets = candidateSets.filter(combo => {
            const comboSet = new Set(combo);
            return !historySets.some(histSet => {
                // Check if all numbers in combo exist in this historical draw
                return combo.every(num => histSet.has(num));
            });
        });

        // Calculate scores for each never-seen set
        const results = neverSeenSets.map(numbers => {
            // Calculate how often these numbers appear in next draws
            let nextDrawScore = 0;
            numbers.forEach(num => {
                nextDrawScore += nextDrawFrequency.get(num) || 0;
            });

            const contextRate = (nextDrawScore / (sortedHistory.length * setSize)) * 100;

            // Global rate: how often this exact set appears
            const globalRate = 0; // Always 0 since it never appeared

            return {
                numbers: numbers.sort((a, b) => a - b),
                count: 0, // Never appeared
                contextRate,
                globalRate,
                diff: contextRate
            };
        })
            .filter(item => {
                if (this.trendFilter() === 'above') return item.diff > 0;
                if (this.trendFilter() === 'below') return item.diff < 0;
                return true;
            })
            .sort((a, b) => b.contextRate - a.contextRate)
            .slice(0, this.limit());

        this.predictiveResults.set(results);
        this.isLoading.set(false);
    }

    private getCombinations(arr: number[], size: number): number[][] {
        if (size <= 0) return [[]];
        const result: number[][] = [];
        const f = (start: number, prev: number[]) => {
            if (prev.length === size) {
                result.push(prev);
                return;
            }
            for (let i = start; i < arr.length; i++) {
                f(i + 1, [...prev, arr[i]]);
            }
        };
        f(0, []);
        return result;
    }

    private hasEverBeenGrouped(history: LotteryResult[], group: number[]): boolean {
        return history.some(draw => {
            const drawNums = draw.result.split(/[,-]/).map(s => Number(s.trim())).filter(n => !isNaN(n));
            return group.every(num => drawNums.includes(num));
        });
    }

    private countGroupOccurrences(history: LotteryResult[], group: number[]): number {
        let count = 0;
        history.forEach(draw => {
            const drawNums = draw.result.split(/[,-]/).map(s => Number(s.trim())).filter(n => !isNaN(n));
            if (group.every(num => drawNums.includes(num))) {
                count++;
            }
        });
        return count;
    }

    toggleMode(mode: 'frequent' | 'next') {
        this.analysisMode.set(mode);
        // Clear results when switching mode to ensure fresh analysis if desired
        this.predictiveResults.set([]);
    }

    setTrendFilter(filter: 'above' | 'below' | 'all') {
        this.trendFilter.set(filter);
        // If results exist, re-run to apply new filter trend immediately
        if (this.analysisMode() === 'next' && this.predictiveResults().length > 0) {
            this.runPredictiveAnalysis();
        }
    }

    toggleMark(numbers: number[], includeSelected: boolean = false) {
        // If in predictive mode and includeSelected is true, add the selected number
        let finalNumbers = [...numbers];
        if (includeSelected && this.analysisMode() === 'next' && this.selectedNumber() !== null) {
            finalNumbers = [this.selectedNumber()!, ...numbers].sort((a, b) => a - b);
        }

        const key = finalNumbers.join(',');
        const newSet = new Set(this.markedGroups());
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        this.markedGroups.set(newSet);
    }

    togglePanel() {
        this.isPanelCollapsed.update(v => !v);
    }

    isMarked(numbers: number[]): boolean {
        return this.markedGroups().has(numbers.join(','));
    }

    isMarkedWithSelected(numbers: number[]): boolean {
        if (this.selectedNumber() === null) return false;
        const fullGroup = [this.selectedNumber()!, ...numbers].sort((a, b) => a - b);
        return this.markedGroups().has(fullGroup.join(','));
    }


    setGroupSize(size: number) {
        this.groupSize.set(size);
        this.predictiveResults.set([]);
    }

    constructor() {
        // Handle responsive grid for virtual scroll
        window.addEventListener('resize', this.onResizeFn);
    }

    ngOnDestroy() {
        window.removeEventListener('resize', this.onResizeFn);
    }

    selectNumber(num: number) {
        if (this.selectedNumber() === num) {
            this.selectedNumber.set(null);
        } else {
            this.selectedNumber.set(num);
        }
        this.predictiveResults.set([]);
    }

    getLabel(size: number): string {
        switch (size) {
            case 2: return 'Pairs';
            case 3: return 'Triplets';
            case 4: return 'Quadruplets';
            case 5: return 'Quintuplets';
            case 6: return 'Sextuplets';
            default: return `Sets of ${size}`;
        }
    }

    setLimit(newLimit: number) {
        this.limit.set(newLimit);
    }

    getBallColor(num: number): string {
        if (num <= 10) return 'bg-yellow-500 shadow-yellow-500/50';
        if (num <= 20) return 'bg-blue-500 shadow-blue-500/50';
        if (num <= 30) return 'bg-red-500 shadow-red-500/50';
        if (num <= 40) return 'bg-green-500 shadow-green-500/50';
        return 'bg-purple-500 shadow-purple-500/50';
    }
    trackByFn(index: number, item: any): string {
        if (Array.isArray(item)) {
            return item.map(g => g.numbers.join(',')).join('|');
        }
        return item.numbers.join(',');
    }
}
