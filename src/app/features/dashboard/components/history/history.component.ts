import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LotteryResult } from '../../models/lottery';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent {
  @Input() history: LotteryResult[] = [];

  getBallColor(num: number): string {
    if (num <= 10) return 'bg-yellow-500';
    if (num <= 20) return 'bg-blue-500';
    if (num <= 30) return 'bg-red-500';
    if (num <= 40) return 'bg-green-500';
    return 'bg-purple-500';
  }

  parseResult(resultStr: string): number[] {
    if (!resultStr) return [];
    return resultStr.split(/[,-]/).map(s => s.trim()).filter(s => s).map(Number);
  }
}
