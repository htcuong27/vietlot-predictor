import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LotteryResult } from '../../models/lottery';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent implements OnChanges {
  @Input() history: LotteryResult[] = [];

  limit = 10;
  limitOptions = [10, 20, 50, 100];

  selectedYear: number | null = null;
  selectedMonth: number | null = null;
  years: number[] = [];
  months: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['history'] && this.history.length > 0) {
      this.extractYears();
    }
  }

  private extractYears() {
    const uniqueYears = new Set<number>();
    this.history.forEach(item => {
      const date = this.parseDate(item.date);
      if (date) {
        uniqueYears.add(date.getFullYear());
      }
    });
    this.years = Array.from(uniqueYears).sort((a, b) => b - a);
  }

  get filteredHistory(): LotteryResult[] {
    let filtered = this.history;

    if (this.selectedYear) {
      filtered = filtered.filter(item => {
        const date = this.parseDate(item.date);
        return date ? date.getFullYear() === this.selectedYear : false;
      });
    }

    if (this.selectedMonth) {
      filtered = filtered.filter(item => {
        const date = this.parseDate(item.date);
        return date ? date.getMonth() + 1 === this.selectedMonth : false;
      });
    }

    return filtered.slice(0, this.limit);
  }

  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    // Handle "DD-MM-YYYY" or "DD-MM-YYYY HH:mm:ss"
    // Remove potential time part first if it exists
    const cleanDateStr = dateStr.split(' ')[0];
    const parts = cleanDateStr.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return null;
  }

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
