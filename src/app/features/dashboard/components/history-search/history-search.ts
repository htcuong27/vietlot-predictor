import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { LotteryResult } from '../../models/lottery';
import { InteractionService } from '../../services/interaction.service';


@Component({
    selector: 'app-history-search',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './history-search.html',
    styleUrls: ['./history-search.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistorySearch {
    constructor(private interactionService: InteractionService) {
        // Listen for external requests to check numbers
        effect(() => {
            const numbers = this.interactionService.checkNumbers();
            if (numbers) {
                this.selectedNumbers.set(numbers);
            }
        }, { allowSignalWrites: true });
    }

    history = input<LotteryResult[]>([]);

    product = input<'645' | '655'>('645');

    selectedNumbers = signal<number[]>([]);
    maxNum = computed(() => this.product() === '645' ? 45 : 55);
    availableNumbers = computed(() => Array.from({ length: this.maxNum() }, (_, i) => i + 1));

    searchResult = computed(() => {
        const selected = this.selectedNumbers();
        const data = this.history();
        if (selected.length !== 6 || !data.length) return null;

        const sortedSelected = [...selected].sort((a, b) => a - b);
        const selectedKey = sortedSelected.join(',');

        // Find full match (6/6)
        const matches = data.filter(draw => {
            const drawNums = this.parseNumbers(draw.result);
            if (drawNums.length < 6) return false;

            // For exact 6-number match in the main numbers
            const main6 = drawNums.slice(0, 6).sort((a, b) => a - b);
            return main6.join(',') === selectedKey;
        });

        return {
            hasWon: matches.length > 0,
            draws: matches,
            count: matches.length
        };
    });

    toggleNumber(num: number) {
        const current = this.selectedNumbers();
        if (current.includes(num)) {
            this.selectedNumbers.set(current.filter(n => n !== num));
        } else if (current.length < 6) {
            this.selectedNumbers.set([...current, num].sort((a, b) => a - b));
        }
    }

    randomize() {
        const pool = this.availableNumbers();
        const result: number[] = [];
        const tempPool = [...pool];

        for (let i = 0; i < 6; i++) {
            const randomIndex = Math.floor(Math.random() * tempPool.length);
            result.push(tempPool[randomIndex]);
            tempPool.splice(randomIndex, 1);
        }
        this.selectedNumbers.set(result.sort((a, b) => a - b));
    }

    clear() {
        this.selectedNumbers.set([]);
    }

    private parseNumbers(resultStr: string): number[] {
        return resultStr.split(/[,-]/)
            .map(s => Number(s.trim()))
            .filter(n => !isNaN(n));
    }

    getBallColor(num: number): string {
        if (num <= 10) return 'bg-yellow-500 shadow-yellow-500/50';
        if (num <= 20) return 'bg-blue-500 shadow-blue-500/50';
        if (num <= 30) return 'bg-red-500 shadow-red-500/50';
        if (num <= 40) return 'bg-green-500 shadow-green-500/50';
        return 'bg-purple-500 shadow-purple-500/50';
    }

    async pasteFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            // Try to extract 6 numbers
            const numbers = text.split(/[,;\s-]+/)
                .map(s => parseInt(s.trim()))
                .filter(n => !isNaN(n) && n > 0 && n <= this.maxNum());

            if (numbers.length >= 6) {
                this.selectedNumbers.set(numbers.slice(0, 6).sort((a, b) => a - b));
            } else {
                alert('Could not find enough valid numbers in clipboard.');
            }
        } catch (e) {
            alert('Clipboard access denied or error.');
        }
    }
}

