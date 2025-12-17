import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { LotteryService } from './services/lottery.service';
import { PredictionService } from './services/prediction.service';
import { AiService } from '../../core/services/ai.service';
import { ChartComponent } from './components/chart/chart.component';
import { HistoryComponent } from './components/history/history.component';
import { AlgorithmType } from './models/algorithm';
import { SequenceNumbers } from './components/sequence-numbers/sequence-numbers';
import { PatternDrawing } from './components/pattern-drawing/pattern-drawing';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ChartComponent, HistoryComponent, SequenceNumbers, PatternDrawing],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
  product = signal<'645' | '655'>('645');

  // Use service signals directly
  latestResult = computed(() => {
    return this.product() === '645' ? this.lotteryService.latest645() : this.lotteryService.latest655();
  });

  history = computed(() => {
    return this.product() === '645' ? this.lotteryService.results645() : this.lotteryService.results655();
  });

  // Prediction State
  predictions = signal<{ numbers: number[], score: number, explanation: string }[]>([]);
  selectedAlgorithm = signal<AlgorithmType>('random');
  targetScore = signal<number>(80);
  isLoading = false;
  errorMessage = '';

  algorithms: { value: AlgorithmType, label: string, description: string }[] = [
    { value: 'random', label: 'Random Selection', description: 'Generates completely random numbers without any historical bias.' },
    { value: 'hot', label: 'Hot Numbers (Frequent)', description: 'Prioritizes numbers that have appeared most frequently in the last 100 draws.' },
    { value: 'cold', label: 'Cold Numbers (Rare)', description: 'Selects numbers that haven\'t appeared for a long time, betting on a comeback.' },
    { value: 'balanced', label: 'Balanced Mix', description: 'Combines hot and random numbers for a balanced approach.' },
    { value: 'targetScore', label: 'Target Score', description: 'Generates combinations that match your desired statistical score (0-100).' },
    { value: 'pairAnalysis', label: 'Pair Analysis', description: 'Uses the most frequent number pairs from recent history to build combinations.' },
    { value: 'lastDigit', label: 'Last Digit Analysis', description: 'Focuses on numbers ending with "lucky" digits that appear frequently.' },
    { value: 'csprng', label: 'CSPRNG (Secure)', description: 'Uses browser\'s cryptographic random generator for high-security randomness.' },
    { value: 'vrf', label: 'Chainlink VRF (Simulated)', description: 'Simulates Verifiable Random Function with a deterministic seed.' },
    { value: 'ai', label: 'AI Prediction (Gemini)', description: 'Uses Google Gemini AI to analyze patterns and suggest numbers.' }
  ];

  selectedAlgorithmDescription = computed(() => {
    const algo = this.algorithms.find(a => a.value === this.selectedAlgorithm());
    return algo ? algo.description : '';
  });

  constructor(
    private route: ActivatedRoute,
    public lotteryService: LotteryService,
    private predictionService: PredictionService,
    private aiService: AiService
  ) {
    // React to route changes
    this.route.params.subscribe(params => {
      const prod = params['product'] as '645' | '655';
      if (prod === '645' || prod === '655') {
        this.product.set(prod);
        this.predictions.set([]); // Reset predictions on switch
        // Auto-refresh data when entering the product page
        this.lotteryService.refresh(prod);
      }
    });
  }

  ngOnInit() { }

  async generatePrediction() {
    console.log('Generating prediction...');
    this.isLoading = true;
    this.errorMessage = '';

    const p = this.product();
    const hist = this.history();
    const algo = this.selectedAlgorithm();

    try {
      // Generate 1 or 5 predictions depending on mode or user preference
      const count = algo === 'targetScore' ? 5 : 1;

      const results = await this.predictionService.predictMultiple(
        this.selectedAlgorithm(),
        hist,
        this.product(),
        5, // Generate 5 options
        this.targetScore()
      );

      if (results.length === 0) {
        this.errorMessage = 'Could not generate predictions. Please try a different algorithm or target score.';
        setTimeout(() => this.errorMessage = '', 3000); // Clear after 3 seconds
      } else {
        this.predictions.set(results);
      }
    } catch (error) {
      console.error(error);
      this.errorMessage = 'An error occurred during prediction.';
    } finally {
      this.isLoading = false;
    }
  }

  getBallColor(num: number): string {
    if (num <= 10) return 'bg-yellow-500 shadow-yellow-500/50';
    if (num <= 20) return 'bg-blue-500 shadow-blue-500/50';
    if (num <= 30) return 'bg-red-500 shadow-red-500/50';
    if (num <= 40) return 'bg-green-500 shadow-green-500/50';
    return 'bg-purple-500 shadow-purple-500/50';
  }

  // Helper to parse result string
  parseResult(resultStr: string): number[] {
    if (!resultStr) return [];
    return resultStr.split(/[,-]/).map(s => s.trim()).filter(s => s).map(Number);
  }
}
