import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { LotteryResult } from "../../models/lottery";

@Component({
    selector: 'app-sequence-numbers',
    standalone: true,
    templateUrl: './sequence-numbers.html',
    styleUrls: ['./sequence-numbers.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SequenceNumbers {
    product = input<'645' | '655'>('645');
    history = input<LotteryResult[]>();

    numbers = computed(() => this.generateNumbers(this.product()));

    sequenceNumbers = computed(() => {
        const history = this.history();
        const baseNumbers = this.numbers();

        const stats = baseNumbers.map((number) => ({
            number: number,
            count: 0,
            max: 0,
            recent: Infinity
        }));

        if (!history?.length) {
            return stats;
        }

        const chronHistory = [...history].reverse();

        chronHistory.forEach((data) => {
            const result = data.result.split(',').map((num) => parseInt(num));

            stats.forEach((stat) => {
                if (!result.includes(stat.number)) {
                    stat.count++;
                } else {
                    stat.recent = stat.count;
                    stat.count = 0;
                }
                stat.max = Math.max(stat.count, stat.max);
            });
        });

        return stats;
    });

    generateNumbers(product: '645' | '655'): number[] {
        if (product === '645') {
            return Array.from({ length: 45 }, (_, i) => i + 1);
        } else {
            return Array.from({ length: 55 }, (_, i) => i + 1);
        }
    }
}