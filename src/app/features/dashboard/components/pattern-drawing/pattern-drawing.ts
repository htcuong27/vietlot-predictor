import { CommonModule } from "@angular/common";
import { AfterViewInit, Component, computed, effect, ElementRef, HostListener, input, signal, ViewChild } from "@angular/core";
import { AiService } from "../../../../core/services/ai.service";
import { LotteryResult } from "../../models/lottery";

interface Point {
    x: number;
    y: number;
}

interface Pattern {
    numbers: number[];
    points: Point[];
    shape: string; // Description of the shape
}

@Component({
    selector: 'app-pattern-drawing',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './pattern-drawing.html',
    styleUrls: ['./pattern-drawing.scss'],
})
export class PatternDrawing implements AfterViewInit {
    @ViewChild('currentCanvas', { static: false }) currentCanvasRef!: ElementRef<HTMLCanvasElement>;
    @ViewChild('predictedCanvas', { static: false }) predictedCanvasRef!: ElementRef<HTMLCanvasElement>;

    product = input<'645' | '655'>('645');
    history = input<LotteryResult[]>();

    // Grid configuration
    numbersPerRow = 8;
    maxNumber = computed(() => this.product() === '645' ? 45 : 55);
    totalRows = computed(() => Math.ceil(this.maxNumber() / this.numbersPerRow));

    // All numbers in grid
    gridNumbers = computed(() => {
        return Array.from({ length: this.maxNumber() }, (_, i) => i + 1);
    });

    // Current patterns from history
    patterns = signal<Pattern[]>([]);

    // Selected pattern to display
    selectedPatternIndex = signal<number>(0);

    // Predicted next pattern
    predictedPattern = signal<Pattern | null>(null);

    count = signal<number>(0);

    constructor(private aiService: AiService) {
        effect(() => {
            if (this.history()?.length) {
                this.analyzePatterns();
            }
        }, { allowSignalWrites: true });

        // Redraw when patterns or selection changes
        effect(() => {
            // Register dependencies
            const p = this.patterns();
            const idx = this.selectedPatternIndex();
            const pred = this.predictedPattern();
            const ai = this.useAI;

            // Draw on next tick to allow DOM to settle
            setTimeout(() => this.drawCanvases(), 0);
        });
    }

    @HostListener('window:resize')
    onResize() {
        this.drawCanvases();
    }

    // AI Toggle
    useAI = false;
    isAnalyzing = false;

    toggleAI(event: Event) {
        const checked = (event.target as HTMLInputElement).checked;
        this.useAI = checked;
        this.usePredictiveNextPattern();
    }

    counter() {
        this.count.update(c => c + 1);
    }

    usePredictiveNextPattern() {
        if (this.patterns().length > 0) {
            this.predictNextPattern(this.patterns());
        }
    }

    /**
     * Analyze patterns from history
     */
    analyzePatterns(): void {
        const historyData = this.history() || [];
        const newPatterns: Pattern[] = [];

        // Take last 10 results for pattern analysis
        const recentResults = historyData.slice(0, 10);

        recentResults.forEach((result) => {
            const numbers = result.result.split(/[,-]/).map(num => parseInt(num.trim())).filter(n => !isNaN(n));
            if (this.product() === '655' && numbers.length > 6) {
                numbers.splice(6, 1);
            }
            const points = numbers.map(num => this.numberToPoint(num));
            const shape = this.detectShape(points);

            newPatterns.push({
                numbers,
                points,
                shape
            });
        });

        this.patterns.set(newPatterns);

        // Predict next pattern
        if (newPatterns.length > 0) {
            this.predictNextPattern(newPatterns);
        }
    }

    /**
     * Convert number to grid point (x, y)
     */
    numberToPoint(num: number): Point {
        const index = num - 1;
        const row = Math.floor(index / this.numbersPerRow);
        const col = index % this.numbersPerRow;
        return { x: col, y: row };
    }

    /**
     * Convert point to number
     */
    pointToNumber(point: Point): number {
        return point.y * this.numbersPerRow + point.x + 1;
    }

    /**
     * Detect shape pattern from points
     */
    detectShape(points: Point[]): string {
        if (points.length < 3) return 'Scattered';

        // Calculate center point
        const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

        // Check for various patterns
        const isVertical = this.checkVerticalPattern(points);
        const isHorizontal = this.checkHorizontalPattern(points);
        const isDiagonal = this.checkDiagonalPattern(points);
        const isCircular = this.checkCircularPattern(points, centerX, centerY);
        const isZigzag = this.checkZigzagPattern(points);

        if (isVertical) return 'Vertical Line';
        if (isHorizontal) return 'Horizontal Line';
        if (isDiagonal) return 'Diagonal Line';
        if (isCircular) return 'Circular';
        if (isZigzag) return 'Zigzag';

        return 'Complex Pattern';
    }

    /**
     * Check if points form a vertical pattern
     */
    checkVerticalPattern(points: Point[]): boolean {
        const xValues = points.map(p => p.x);
        const uniqueX = new Set(xValues);
        return uniqueX.size <= 2; // Allow some variation
    }

    /**
     * Check if points form a horizontal pattern
     */
    checkHorizontalPattern(points: Point[]): boolean {
        const yValues = points.map(p => p.y);
        const uniqueY = new Set(yValues);
        return uniqueY.size <= 2;
    }

    /**
     * Check if points form a diagonal pattern
     */
    checkDiagonalPattern(points: Point[]): boolean {
        if (points.length < 3) return false;

        // Sort by x coordinate
        const sorted = [...points].sort((a, b) => a.x - b.x);

        // Check if slope is consistent
        let positiveSlope = 0;
        let negativeSlope = 0;

        for (let i = 1; i < sorted.length; i++) {
            const slope = (sorted[i].y - sorted[i - 1].y) / (sorted[i].x - sorted[i - 1].x);
            if (slope > 0) positiveSlope++;
            if (slope < 0) negativeSlope++;
        }

        return positiveSlope > sorted.length * 0.6 || negativeSlope > sorted.length * 0.6;
    }

    /**
     * Check if points form a circular pattern
     */
    checkCircularPattern(points: Point[], centerX: number, centerY: number): boolean {
        if (points.length < 4) return false;

        const distances = points.map(p =>
            Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2))
        );

        const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
        const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length;

        // Low variance means points are roughly equidistant from center
        return variance < 2;
    }

    /**
     * Check if points form a zigzag pattern
     */
    checkZigzagPattern(points: Point[]): boolean {
        if (points.length < 4) return false;

        const sorted = [...points].sort((a, b) => a.x - b.x);
        let direction = 0; // 1 for up, -1 for down
        let changes = 0;

        for (let i = 1; i < sorted.length; i++) {
            const currentDirection = sorted[i].y > sorted[i - 1].y ? 1 : -1;
            if (direction !== 0 && currentDirection !== direction) {
                changes++;
            }
            direction = currentDirection;
        }

        return changes >= 2;
    }

    /**
     * Predict next pattern based on historical patterns
     */
    /**
     * Predict next pattern based on historical patterns
     */
    async predictNextPattern(patterns: Pattern[]) {
        if (this.useAI) {
            this.isAnalyzing = true;
            try {

                const lastPattern = patterns[patterns.length - 1];
                // Use last 3 patterns for context
                const contextPatterns = patterns.slice(-3).map(p => p.points);

                // Simplify for token limit - just send last pattern points
                const numbers = this.aiService.generatePointNumbers(this.product()).sort((a, b) => a - b);
                const result = numbers.map(num => this.numberToPoint(num));

                const predictedNumbers = numbers;
                this.predictedPattern.set({
                    numbers: predictedNumbers,
                    points: result,
                    shape: 'AI Predicted Pattern'
                });
            } catch (e) {
                console.error('AI Pattern Error', e);
                this.runAlgorithmicPrediction(patterns);
            } finally {
                this.isAnalyzing = false;
            }
        } else {
            this.runAlgorithmicPrediction(patterns);
        }
    }

    runAlgorithmicPrediction(patterns: Pattern[]) {
        // Analyze pattern trends
        const shapeFrequency = new Map<string, number>();

        patterns.forEach(pattern => {
            const count = shapeFrequency.get(pattern.shape) || 0;
            shapeFrequency.set(pattern.shape, count + 1);
        });

        // Find most common shape
        let mostCommonShape = '';
        let maxCount = 0;
        shapeFrequency.forEach((count, shape) => {
            if (count > maxCount) {
                maxCount = count;
                mostCommonShape = shape;
            }
        });

        // Generate predicted numbers based on most common pattern
        const predictedNumbers = this.generateNumbersForShape(mostCommonShape);
        const predictedPoints = predictedNumbers.map(num => this.numberToPoint(num));

        this.predictedPattern.set({
            numbers: predictedNumbers,
            points: predictedPoints,
            shape: mostCommonShape
        });
    }

    /**
     * Generate numbers that would form a specific shape
     */
    generateNumbersForShape(shape: string): number[] {
        const numbers: number[] = [];
        const maxNum = this.maxNumber();

        switch (shape) {
            case 'Vertical Line':
                // Pick a random column
                const col = Math.floor(Math.random() * this.numbersPerRow);
                for (let row = 0; row < this.totalRows() && numbers.length < 6; row++) {
                    const num = row * this.numbersPerRow + col + 1;
                    if (num <= maxNum) numbers.push(num);
                }
                break;

            case 'Horizontal Line':
                // Pick a random row
                const row = Math.floor(Math.random() * this.totalRows());
                for (let c = 0; c < this.numbersPerRow && numbers.length < 6; c++) {
                    const num = row * this.numbersPerRow + c + 1;
                    if (num <= maxNum) numbers.push(num);
                }
                break;

            case 'Diagonal Line':
                // Generate diagonal pattern
                const startRow = Math.floor(Math.random() * (this.totalRows() - 3));
                for (let i = 0; i < 6; i++) {
                    const num = (startRow + i) * this.numbersPerRow + i + 1;
                    if (num <= maxNum) numbers.push(num);
                }
                break;

            default:
                // Random selection for complex patterns
                while (numbers.length < 6) {
                    const num = Math.floor(Math.random() * maxNum) + 1;
                    if (!numbers.includes(num)) {
                        numbers.push(num);
                    }
                }
        }

        return numbers.slice(0, 6).sort((a, b) => a - b);
    }

    /**
     * Get the grid row for a number
     */
    getRow(num: number): number {
        return Math.floor((num - 1) / this.numbersPerRow);
    }

    /**
     * Get the grid column for a number
     */
    getCol(num: number): number {
        return (num - 1) % this.numbersPerRow;
    }

    /**
     * Check if a number is in the selected pattern
     */
    isNumberInPattern(num: number, patternIndex: number): boolean {
        const pattern = this.patterns()[patternIndex];
        return pattern ? pattern.numbers.includes(num) : false;
    }

    /**
     * Check if a number is in the predicted pattern
     */
    isNumberInPrediction(num: number): boolean {
        const pattern = this.predictedPattern();
        return pattern ? pattern.numbers.includes(num) : false;
    }

    /**
     * Select a pattern to display
     */
    selectPattern(index: number): void {
        this.selectedPatternIndex.set(index);
        // Redraw canvas when pattern changes
        setTimeout(() => this.drawCanvases(), 0);
    }

    /**
     * Lifecycle hook - called after view initialization
     */
    ngAfterViewInit(): void {
        // Initial draw
        setTimeout(() => this.drawCanvases(), 100);
    }

    /**
     * Draw both canvases
     */
    drawCanvases(): void {
        if (this.patterns().length > 0) {
            this.drawCurrentPattern();
        }
        if (this.predictedPattern()) {
            this.drawPredictedPattern();
        }
    }

    /**
     * Draw current pattern on canvas
     */
    drawCurrentPattern(): void {
        const canvas = this.currentCanvasRef?.nativeElement;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const pattern = this.patterns()[this.selectedPatternIndex()];
        if (!pattern) return;

        // Set canvas size based on container
        const containerWidth = canvas.parentElement?.clientWidth || 600;
        const cellSize = Math.floor(containerWidth / this.numbersPerRow);
        const logicalWidth = cellSize * this.numbersPerRow;
        const logicalHeight = cellSize * this.totalRows();

        // High DPI scaling
        const dpr = window.devicePixelRatio || 1;
        canvas.width = logicalWidth * dpr;
        canvas.height = logicalHeight * dpr;

        // Ensure visual size matches logical size
        canvas.style.width = `${logicalWidth}px`;
        canvas.style.height = `${logicalHeight}px`;

        // Scale context to match dpr
        ctx.scale(dpr, dpr);

        // Clear canvas
        ctx.clearRect(0, 0, logicalWidth, logicalHeight);

        // Draw connecting lines with gradient and glow
        if (pattern.points.length > 1) {
            ctx.save();

            // Draw glow effect
            ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
            ctx.shadowBlur = 15;

            // Create gradient
            const gradient = ctx.createLinearGradient(
                pattern.points[0].x * cellSize + cellSize / 2,
                pattern.points[0].y * cellSize + cellSize / 2,
                pattern.points[pattern.points.length - 1].x * cellSize + cellSize / 2,
                pattern.points[pattern.points.length - 1].y * cellSize + cellSize / 2
            );
            gradient.addColorStop(0, '#3B82F6');
            gradient.addColorStop(0.5, '#60A5FA');
            gradient.addColorStop(1, '#3B82F6');

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Draw path
            ctx.beginPath();
            ctx.moveTo(
                pattern.points[0].x * cellSize + cellSize / 2,
                pattern.points[0].y * cellSize + cellSize / 2
            );

            for (let i = 1; i < pattern.points.length; i++) {
                ctx.lineTo(
                    pattern.points[i].x * cellSize + cellSize / 2,
                    pattern.points[i].y * cellSize + cellSize / 2
                );
            }
            ctx.stroke();

            // Draw circles at each point
            pattern.points.forEach((point, index) => {
                const x = point.x * cellSize + cellSize / 2;
                const y = point.y * cellSize + cellSize / 2;

                // Outer glow circle
                ctx.beginPath();
                ctx.arc(x, y, 12, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
                ctx.fill();

                // Inner circle
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, Math.PI * 2);
                ctx.fillStyle = '#3B82F6';
                ctx.fill();

                // Number label
                ctx.fillStyle = 'white';
                ctx.font = 'bold 10px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText((index + 1).toString(), x, y);
            });

            ctx.restore();
        }
    }

    /**
     * Draw predicted pattern on canvas
     */
    drawPredictedPattern(): void {
        const canvas = this.predictedCanvasRef?.nativeElement;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const pattern = this.predictedPattern();
        if (!pattern) return;

        // Set canvas size based on container
        const containerWidth = canvas.parentElement?.clientWidth || 600;
        const cellSize = Math.floor(containerWidth / this.numbersPerRow);
        const logicalWidth = cellSize * this.numbersPerRow;
        const logicalHeight = cellSize * this.totalRows();

        // High DPI scaling
        const dpr = window.devicePixelRatio || 1;
        canvas.width = logicalWidth * dpr;
        canvas.height = logicalHeight * dpr;

        // Ensure visual size matches logical size
        canvas.style.width = `${logicalWidth}px`;
        canvas.style.height = `${logicalHeight}px`;

        // Scale context to match dpr
        ctx.scale(dpr, dpr);

        // Clear canvas
        ctx.clearRect(0, 0, logicalWidth, logicalHeight);

        // Draw connecting lines with gradient and glow (dashed)
        if (pattern.points.length > 1) {
            ctx.save();

            // Draw glow effect
            ctx.shadowColor = 'rgba(16, 185, 129, 0.5)';
            ctx.shadowBlur = 15;

            // Create gradient
            const gradient = ctx.createLinearGradient(
                pattern.points[0].x * cellSize + cellSize / 2,
                pattern.points[0].y * cellSize + cellSize / 2,
                pattern.points[pattern.points.length - 1].x * cellSize + cellSize / 2,
                pattern.points[pattern.points.length - 1].y * cellSize + cellSize / 2
            );
            gradient.addColorStop(0, '#10B981');
            gradient.addColorStop(0.5, '#34D399');
            gradient.addColorStop(1, '#10B981');

            ctx.strokeStyle = gradient;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.setLineDash([10, 5]); // Dashed line

            // Draw path
            ctx.beginPath();
            ctx.moveTo(
                pattern.points[0].x * cellSize + cellSize / 2,
                pattern.points[0].y * cellSize + cellSize / 2
            );

            for (let i = 1; i < pattern.points.length; i++) {
                ctx.lineTo(
                    pattern.points[i].x * cellSize + cellSize / 2,
                    pattern.points[i].y * cellSize + cellSize / 2
                );
            }
            ctx.stroke();

            // Draw circles at each point
            pattern.points.forEach((point, index) => {
                const x = point.x * cellSize + cellSize / 2;
                const y = point.y * cellSize + cellSize / 2;

                // Outer glow circle
                ctx.beginPath();
                ctx.arc(x, y, 12, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
                ctx.fill();

                // Inner circle
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, Math.PI * 2);
                ctx.fillStyle = '#10B981';
                ctx.fill();

                // Number label
                ctx.fillStyle = 'white';
                ctx.font = 'bold 10px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText((index + 1).toString(), x, y);
            });

            ctx.restore();
        }
    }
}
