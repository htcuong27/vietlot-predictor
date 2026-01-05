import { ChangeDetectionStrategy, Component, Input, OnChanges, signal, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective, NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartEvent, ChartType } from 'chart.js';
import { LotteryResult } from '../../models/lottery';

@Component({
  selector: 'app-chart',
  standalone: true,
  imports: [CommonModule, NgChartsModule],
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChartComponent implements OnChanges {
  @Input() history: LotteryResult[] = [];
  @Input() product: '645' | '655' = '645';

  @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;

  average = signal(0);

  public barChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    scales: {
      x: {},
      y: {
        min: 0
      }
    },
    plugins: {
      legend: {
        display: true,
      }
    }
  };
  public barChartType: ChartType = 'bar';

  public barChartData: ChartData<'bar'> = {
    labels: [
    ],
    datasets: [
      { data: [], label: 'Numbers' },
    ]
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['history'] && this.history.length > 0) {
      this.updateChart();
    }
  }

  private updateChart() {
    const freqs: { [key: number]: number } = {};
    const maxNum = this.product === '645' ? 45 : 55;

    // Initialize
    for (let i = 1; i <= maxNum; i++) freqs[i] = 0;

    // Count
    this.history.forEach(draw => {
      if (draw.result) {
        let numbers = draw.result.split(/[,-]/).map(s => Number(s.trim())).filter(n => !isNaN(n));

        if (this.product === '655' && numbers.length > 6) {
          numbers = numbers.slice(0, 6);
        }

        numbers.forEach(num => {
          if (freqs[num] !== undefined) freqs[num]++;
        });
      }
    });

    const data = Object.entries(freqs);
    this.average.set(data.reduce((acc, [, v]) => acc + v, 0) / data.length);

    this.barChartData.labels = data.map(([k]) => k);
    this.barChartData.datasets[0].data = data.map(([, v]) => v);
    this.barChartData.datasets[0].backgroundColor = data.map(([, v]) => v > this.average() ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.1)');
    this.barChartData.datasets[0].borderColor = data.map(([, v]) => v > this.average() ? 'rgb(59, 130, 246)' : 'rgb(59, 130, 246)');
    this.barChartData.datasets[0].borderWidth = 1;

    this.chart?.update();
  }
}
