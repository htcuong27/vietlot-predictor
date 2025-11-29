import { Component, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective, NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartEvent, ChartType } from 'chart.js';
import { LotteryResult } from '../../models/lottery';

@Component({
  selector: 'app-chart',
  standalone: true,
  imports: [CommonModule, NgChartsModule],
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.scss']
})
export class ChartComponent implements OnChanges {
  @Input() history: LotteryResult[] = [];
  @Input() product: '645' | '655' = '645';

  @ViewChild(BaseChartDirective) chart: BaseChartDirective | undefined;

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
    labels: [],
    datasets: [
      { data: [], label: 'Frequency' }
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
        draw.result.split(',').forEach(n => {
          const num = Number(n)
          if (freqs[num] !== undefined) freqs[num]++;
        });
      }
    });

    // Sort and take top 20 for readability
    const sorted = Object.entries(freqs)
      .sort(([, a], [, b]) => b - a)

    this.barChartData.labels = sorted.map(([k]) => k);
    this.barChartData.datasets[0].data = sorted.map(([, v]) => v);
    this.barChartData.datasets[0].backgroundColor = 'rgba(59, 130, 246, 0.5)';
    this.barChartData.datasets[0].borderColor = 'rgb(59, 130, 246)';
    this.barChartData.datasets[0].borderWidth = 1;

    this.chart?.update();
  }
}
