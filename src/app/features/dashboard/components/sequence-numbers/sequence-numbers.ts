import { Component, effect, input, signal } from "@angular/core";
import { LotteryResult } from "../../models/lottery";

@Component({
    selector: 'app-sequence-numbers',
    standalone: true,
    templateUrl: './sequence-numbers.html',
    styleUrls: ['./sequence-numbers.scss']
})
export class SequenceNumbers {
    product = input<'645' | '655'>('645');
    history = input<LotteryResult[]>();
    numbers = signal<number[]>(this.generateNumbers(this.product()));
    sequenceNumbers = signal<{ number: number; count: number, max: number }[]>(
        this.numbers().map((number) => {
            return {
                number: number,
                count: 0,
                max: 0
            }
        })
    );

    constructor() {
        effect(() => {
            if (this.history()?.length) {
                this.sequenceNumbers.update((sequenceNumbers) => {
                    [...this.history() || []]?.reverse()?.map((data) => {
                        const result: number[] = data.result.split(',').map((num) => parseInt(num));
                        sequenceNumbers.forEach((sequenceNumber) => {
                            if (!result.includes(sequenceNumber.number)) {
                                sequenceNumber.count++;
                            } else {
                                sequenceNumber.count = 0;
                            }
                            sequenceNumber.max = Math.max(sequenceNumber.count, sequenceNumber.max);
                        });
                    });
                    return sequenceNumbers;
                });
            }
        }, { allowSignalWrites: true });
    }


    generateNumbers(product: '645' | '655'): number[] {
        if (product === '645') {
            return Array.from({ length: 45 }, (_, i) => i + 1);
        } else {
            return Array.from({ length: 55 }, (_, i) => i + 1);
        }
    }
}